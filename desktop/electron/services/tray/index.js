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

export default {
  name: 'service:tray',
  async apply(mainApp) {
    let tray = null

    globalEventEmitter.on('tray:destroy', () => {
      tray?.destroy?.()
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

      return true
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

    function createTray() {
      if (tray) {
        tray.destroy()
        tray = null
      }

      hideApp()

      tray = new Tray(trayPath)

      tray.setToolTip('escrcpy')

      tray.on('click', () => {
        showApp()
      })

      const contextMenu = Menu.buildFromTemplate([
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
      ])

      tray.setContextMenu(contextMenu)
    }
  },
}
