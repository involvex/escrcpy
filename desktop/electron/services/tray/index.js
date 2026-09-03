import { app, dialog, Menu, Tray } from 'electron'
import { trayPath } from '$electron/configs/index.js'
import electronStore from '$electron/helpers/store/index.js'
import { globalEventEmitter } from '$electron/helpers/emitter/index.js'
import { sleep } from '$/utils'
import command from '$renderer/utils/command/index.js'
import { LATENCY_PRESET_ARGS } from '$/utils/latency-preset/index.js'
import { resolveMainWindow } from '@escrcpy/electron-setup/main'
import { t } from '$electron/helpers/i18n/index.js'
import scrcpy from '$electron/middleware/scrcpy/index.js'
import adb from '$electron/middleware/adb/index.js'
import { assertSafeSerial } from '$electron/helpers/shell/safe-args.js'

const TRAY_REFRESH_DEBOUNCE_MS = 800
const TRAY_MAX_DEVICES = 20

function isWifiDeviceId(id) {
  return String(id ?? '').includes(':') || String(id ?? '').includes('_adb-tls-connect')
}

function truncateLabel(value, max = 48) {
  const text = String(value ?? '')
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function getTrayDeviceLabel(device) {
  const id = String(device?.id ?? '')
  let remark = ''
  try {
    remark = electronStore.get(`device.${id}.remark`) || electronStore.get('device')?.[id]?.remark || ''
  }
  catch {
    remark = ''
  }
  const base = remark ? `${remark} (${id})` : id
  const suffix = device?.type === 'offline' ? ' (offline)' : (isWifiDeviceId(id) ? ' (wifi)' : '')
  return truncateLabel(`${base}${suffix}`)
}

export default {
  name: 'service:tray',
  async apply(mainApp) {
    let tray = null
    let cachedDevices = []
    let rebuildTimer = null
    let trackerClose = null
    let rebuilding = false
    let rebuildQueued = false

    globalEventEmitter.on('tray:destroy', () => {
      stopDeviceWatcher()
      tray?.destroy?.()
      tray = null
    })

    globalEventEmitter.on('tray:create', () => {
      createTray()
    })

    registerWindowCloseHandler()

    async function registerWindowCloseHandler() {
      const mainWindow = await resolveMainWindow(mainApp)

      mainWindow?.on?.('close', async (event) => {
        if (app.isQuiting) {
          return true
        }

        event.preventDefault()

        const minimizeToTray = electronStore.get('common.minimizeToTray')
        if (minimizeToTray) {
          createTray()
          return true
        }

        let appCloseCode = electronStore.get('common.appCloseCode')

        if (![0, 1].includes(appCloseCode)) {
          const { response } = await dialog.showMessageBox({
            type: 'question',
            cancelId: 2,
            buttons: [
              t('appClose.quit'),
              t('appClose.minimize'),
              t('appClose.quit.cancel'),
            ],
            title: t('common.tips'),
            message: t('appClose.message'),
          })

          appCloseCode = response
        }

        closeApp(appCloseCode)
      })
    }

    function showApp() {
      if (process.platform === 'darwin') {
        app.dock.show()
      }

      const mainWindow = mainApp.getMainWindow()

      mainWindow?.show?.()

      if (tray) {
        tray.destroy()
        tray = null
      }
      stopDeviceWatcher()

      return true
    }

    function stopDeviceWatcher() {
      if (rebuildTimer) {
        clearTimeout(rebuildTimer)
        rebuildTimer = null
      }
      try {
        trackerClose?.()
      }
      catch {
        // ignore watcher teardown errors
      }
      trackerClose = null
      rebuilding = false
      rebuildQueued = false
    }

    function sameDeviceIds(a = [], b = []) {
      if (a.length !== b.length) {
        return false
      }
      const left = [...a].map(item => String(item?.id ?? item)).sort()
      const right = [...b].map(item => String(item?.id ?? item)).sort()
      return left.every((id, index) => id === right[index])
    }

    async function refreshTrayDevices() {
      if (!tray || rebuilding) {
        rebuildQueued = true
        return
      }
      rebuilding = true
      try {
        const devices = await adb.getDeviceList().catch(() => [])
        if (!tray) {
          return
        }
        if (!sameDeviceIds(devices, cachedDevices)) {
          cachedDevices = devices
          tray.setContextMenu(Menu.buildFromTemplate(buildTemplate()))
          tray.setToolTip(devices.length ? `escrcpy (${devices.length})` : 'escrcpy')
        }
      }
      catch (error) {
        console.warn('[tray] refresh devices:', error?.message || error)
      }
      finally {
        rebuilding = false
        if (rebuildQueued) {
          rebuildQueued = false
          scheduleDeviceRefresh()
        }
      }
    }

    function scheduleDeviceRefresh() {
      if (rebuildTimer) {
        clearTimeout(rebuildTimer)
      }
      rebuildTimer = setTimeout(() => {
        rebuildTimer = null
        refreshTrayDevices()
      }, TRAY_REFRESH_DEBOUNCE_MS)
    }

    async function startDeviceWatcher() {
      if (trackerClose) {
        return
      }
      try {
        trackerClose = await adb.watch(() => scheduleDeviceRefresh())
      }
      catch (error) {
        console.warn('[tray] watch devices:', error?.message || error)
        trackerClose = null
      }
      scheduleDeviceRefresh()
    }

    function hideApp() {
      if (process.platform === 'darwin') {
        app.dock.hide()
      }

      const mainWindow = mainApp.getMainWindow()

      mainWindow?.hide?.()

      return true
    }

    async function quitApp() {
      const mainWindow = mainApp.getMainWindow()

      stopDeviceWatcher()
      app.isQuiting = true

      mainWindow?.webContents?.send?.('quit-before')

      await sleep(1 * 1000)

      app.quit()

      return true
    }

    function closeApp(response) {
      if (response === 0) {
        quitApp()
        return true
      }
      else if (response === 1) {
        createTray()
        return true
      }

      return false
    }

    function navigateToSettings() {
      const mainWindow = mainApp.getMainWindow()
      if (mainWindow) {
        mainWindow.show()
        mainWindow.webContents.send('navigate-to-route', '/preference')
      }
    }

    function openQuickTerminal() {
      const terminalManager = mainApp.getWindowManager('pages/terminal')
      if (terminalManager) {
        terminalManager.open({
          type: 'local',
          title: t('tray.quickTerminal'),
        })
      }
    }

    async function quickMirrorLastDevice() {
      const lastDevice = electronStore.get('lastConnectedDevice')
      if (!lastDevice?.id) {
        dialog.showMessageBox({
          type: 'info',
          title: t('common.tips'),
          message: t('tray.quickMirror.noDevice'),
        })
        return
      }

      try {
        const presetDevices = electronStore.get('common.latencyPreset') || []
        const presetEnabled = presetDevices.includes(lastDevice.id)
        const args = presetEnabled
          ? command.stringify(LATENCY_PRESET_ARGS)
          : ''

        await scrcpy.quickMirror(lastDevice.id, {
          title: `escrcpy-${lastDevice.id}`,
          args,
        })
      }
      catch (error) {
        console.error('[tray] quickMirror error:', error)
        dialog.showMessageBox({
          type: 'error',
          title: t('common.danger'),
          message: error.message,
        })
      }
    }

    function showDeviceError(error) {
      dialog.showMessageBox({
        type: 'error',
        title: t('common.danger'),
        message: error?.message || String(error),
      })
    }

    function getMirrorArgsFor(id) {
      const presetDevices = electronStore.get('common.latencyPreset') || []
      return presetDevices.includes(id) ? command.stringify(LATENCY_PRESET_ARGS) : ''
    }

    async function mirrorTrayDevice(id) {
      try {
        assertSafeSerial(id)
        await scrcpy.mirror(id, {
          title: `escrcpy-${id}`,
          args: getMirrorArgsFor(id),
        })
      }
      catch (error) {
        console.error('[tray] mirror error:', error)
        showDeviceError(error)
      }
    }

    async function screenshotTrayDevice(id) {
      try {
        assertSafeSerial(id)
        await adb.screencap(id)
      }
      catch (error) {
        console.error('[tray] screenshot error:', error)
        showDeviceError(error)
      }
    }

    function openDeviceTerminal(id) {
      try {
        assertSafeSerial(id)
        const terminalManager = mainApp.getWindowManager('pages/terminal')
        terminalManager?.open({ type: 'device', device: { id }, instanceId: id })
      }
      catch (error) {
        console.error('[tray] terminal error:', error)
        showDeviceError(error)
      }
    }

    async function disconnectTrayDevice(id) {
      try {
        assertSafeSerial(id)
        await adb.disconnect(id)
        scheduleDeviceRefresh()
      }
      catch (error) {
        console.error('[tray] disconnect error:', error)
        showDeviceError(error)
      }
    }

    function buildDevicesSubmenu() {
      if (!cachedDevices.length) {
        return [{ label: t('tray.devices.empty'), enabled: false }]
      }
      const visible = cachedDevices.slice(0, TRAY_MAX_DEVICES)
      const items = visible.map(device => ({
        label: getTrayDeviceLabel(device),
        submenu: [
          { label: t('tray.device.mirror'), click: () => mirrorTrayDevice(device.id) },
          { label: t('tray.device.screenshot'), click: () => screenshotTrayDevice(device.id) },
          { label: t('tray.device.terminal'), click: () => openDeviceTerminal(device.id) },
          { type: 'separator' },
          {
            label: t('tray.device.disconnect'),
            enabled: isWifiDeviceId(device.id),
            click: () => disconnectTrayDevice(device.id),
          },
        ],
      }))
      if (cachedDevices.length > TRAY_MAX_DEVICES) {
        items.push({ type: 'separator' })
        items.push({
          label: t('tray.devices.manage'),
          click: () => {
            showApp()
            const mainWindow = mainApp.getMainWindow()
            mainWindow?.webContents?.send?.('navigate-to-route', '/device')
          },
        })
      }
      return items
    }

    function buildTemplate() {
      return [
        {
          label: t('tray.open'),
          click: () => {
            showApp()
          },
        },
        { type: 'separator' },
        {
          label: t('tray.quickMirror'),
          click: () => {
            quickMirrorLastDevice()
          },
        },
        {
          label: t('tray.quickTerminal'),
          click: () => {
            openQuickTerminal()
          },
        },
        {
          label: t('tray.devices'),
          submenu: buildDevicesSubmenu(),
        },
        { type: 'separator' },
        {
          label: t('tray.settings'),
          click: () => {
            navigateToSettings()
          },
        },
        { type: 'separator' },
        {
          label: t('common.restart'),
          click: () => {
            app.relaunch()
            quitApp()
          },
        },
        {
          label: t('appClose.quit'),
          click: () => {
            quitApp()
          },
        },
      ]
    }

    function createTray() {
      if (tray) {
        tray.destroy()
        tray = null
      }
      stopDeviceWatcher()

      hideApp()

      tray = new Tray(trayPath)

      tray.setToolTip('escrcpy')

      tray.on('click', () => {
        showApp()
      })

      tray.setContextMenu(Menu.buildFromTemplate(buildTemplate()))
      startDeviceWatcher()
    }
  },
}
