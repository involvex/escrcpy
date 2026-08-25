import { app, globalShortcut } from 'electron'
import { Adb } from '@devicefarmer/adbkit'
import electronStore from '$electron/helpers/store/index.js'
import { getAdbPath } from '$electron/configs/which/index.js'
import { setupEnvPath } from '$electron/process/helper.js'

const DEFAULT_MIRROR_SHORTCUTS = [
  {
    accelerator: 'CommandOrControl+D',
    keyevent: '187',
    label: 'Recents',
  },
]

function seedDefaults() {
  const existing = electronStore.get('common.mirrorShortcuts')
  if (!existing || existing.length === 0) {
    electronStore.set('common.mirrorShortcuts', DEFAULT_MIRROR_SHORTCUTS)
  }
}

export default {
  name: 'service:shortcuts',
  deps: ['module:main'],
  async apply(mainApp) {
    let registeredHotkey = null
    const registeredMirrorShortcuts = new Map()

    function showApp() {
      if (process.platform === 'darwin') {
        app.dock.show()
      }

      const mainWindow = mainApp.getMainWindow()
      mainWindow?.show()
      mainWindow?.focus()
    }

    function registerHotkey(shortcut) {
      if (registeredHotkey) {
        globalShortcut.unregister(registeredHotkey)
      }

      if (!shortcut) {
        registeredHotkey = null
        return
      }

      const success = globalShortcut.register(shortcut, () => {
        showApp()
      })

      if (success) {
        registeredHotkey = shortcut
      }
      else {
        console.warn(`[shortcuts] Failed to register global shortcut: ${shortcut}`)
        registeredHotkey = null
      }
    }

    function updateHotkey() {
      const globalHotkey = electronStore.get('common.globalHotkey')
      registerHotkey(globalHotkey)
    }

    let adbClient = null

    function getAdbClient() {
      if (!adbClient) {
        setupEnvPath()
        adbClient = Adb.createClient({ bin: getAdbPath() })
      }
      return adbClient
    }

    async function sendKeyevent(serial, keyevent) {
      try {
        const stream = await getAdbClient().getDevice(serial).shell(`input keyevent ${keyevent}`)
        await Adb.util.readAll(stream)
      }
      catch (error) {
        console.warn(`[shortcuts] Failed to send keyevent ${keyevent} to ${serial}:`, error?.message || error)
      }
    }

    function unregisterMirrorShortcuts() {
      registeredMirrorShortcuts.forEach((accelerator) => {
        globalShortcut.unregister(accelerator)
      })
      registeredMirrorShortcuts.clear()
    }

    function registerMirrorShortcuts() {
      unregisterMirrorShortcuts()

      const shortcuts = electronStore.get('common.mirrorShortcuts') || []

      shortcuts.forEach((item) => {
        if (!item?.accelerator || !item?.keyevent) {
          return
        }

        const success = globalShortcut.register(item.accelerator, () => {
          const serial = electronStore.get('lastConnectedDevice')?.id
          if (serial) {
            sendKeyevent(serial, item.keyevent)
          }
        })

        if (success) {
          registeredMirrorShortcuts.set(item.accelerator, item.accelerator)
        }
        else {
          console.warn(`[shortcuts] Failed to register mirror shortcut: ${item.accelerator}`)
        }
      })
    }

    seedDefaults()
    updateHotkey()
    registerMirrorShortcuts()

    electronStore.onDidChange('common.globalHotkey', (newValue) => {
      registerHotkey(newValue)
    })

    electronStore.onDidChange('common.mirrorShortcuts', () => {
      registerMirrorShortcuts()
    })

    return () => {
      if (registeredHotkey) {
        globalShortcut.unregister(registeredHotkey)
      }
      unregisterMirrorShortcuts()
    }
  },
}
