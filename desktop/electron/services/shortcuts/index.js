import { globalShortcut } from 'electron'
import electronStore from '$electron/helpers/store/index.js'

export default {
  name: 'service:shortcuts',
  deps: ['module:main'],
  async apply(mainApp) {
    let registeredShortcut = null

    function showApp() {
      if (process.platform === 'darwin') {
        app.dock.show()
      }

      const mainWindow = mainApp.getMainWindow()
      mainWindow?.show()
      mainWindow?.focus()
    }

    function registerShortcut(shortcut) {
      if (registeredShortcut) {
        globalShortcut.unregister(registeredShortcut)
      }

      if (!shortcut) {
        registeredShortcut = null
        return
      }

      const success = globalShortcut.register(shortcut, () => {
        showApp()
      })

      if (success) {
        registeredShortcut = shortcut
      }
      else {
        console.warn(`[shortcuts] Failed to register global shortcut: ${shortcut}`)
        registeredShortcut = null
      }
    }

    function updateShortcut() {
      const globalHotkey = electronStore.get('common.globalHotkey')
      registerShortcut(globalHotkey)
    }

    updateShortcut()

    electronStore.onDidChange('common.globalHotkey', (newValue) => {
      registerShortcut(newValue)
    })

    return () => {
      if (registeredShortcut) {
        globalShortcut.unregister(registeredShortcut)
      }
    }
  },
}
