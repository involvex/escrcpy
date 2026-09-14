import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell } from 'electron'
import fs from 'fs-extra'
import path from 'node:path'
import { openLogPath } from '$root/electron/helpers/debugger/index.js'
import electronStore from '$electron/helpers/store/index.js'
import { parsePreferenceImport } from '$renderer/utils/preference-transfer/index.js'
import { isWindowDestroyed } from '$electron/helpers/index.js'

export default {
  name: 'service:handles',
  apply(mainApp) {
    ipcMain.handle(
      'show-open-dialog',
      async (_, { preset = '', ...options } = {}) => {
        const res = await dialog
          .showOpenDialog(options)
          .catch(e => console.warn(e))

        if (res.canceled) {
          throw new Error('User cancel operation')
        }

        if (!res.filePaths.length) {
          throw new Error('Get the directory or file path failure')
        }

        const filePaths = res.filePaths

        switch (preset) {
          case 'replaceFile':
            await fs.copy(filePaths[0], options.filePath, { overwrite: true })
            break
        }

        return filePaths
      },
    )

    ipcMain.handle('open-path', async (_, pathValue) => {
      return shell.openPath(pathValue)
    })

    ipcMain.handle('show-item-in-folder', async (_, filePath) => {
      return shell.showItemInFolder(filePath)
    })

    ipcMain.handle('get-primary-display', async () => {
      const primaryDisplay = screen.getPrimaryDisplay()
      const scaleFactor = primaryDisplay.scaleFactor || 1

      primaryDisplay.titleBarHeight = Math.round(30 * scaleFactor)

      return primaryDisplay
    })

    ipcMain.handle(
      'show-save-dialog',
      async (_, { filePath = '', ...options } = {}) => {
        const res = await dialog
          .showSaveDialog({
            ...options,
          })
          .catch(e => console.warn(e))

        if (res.canceled) {
          throw new Error('User cancel operation')
        }

        if (!res.filePath) {
          throw new Error('Failure to obtain the file path')
        }

        const destinationPath = res.filePath

        await fs.copy(filePath, destinationPath)

        return true
      },
    )

    // Validate and apply a preference config file onto the live store
    ipcMain.handle(
      'import-preference',
      async (_, filePath) => {
        if (typeof filePath !== 'string' || !filePath) {
          throw new Error('Failure to obtain the file path')
        }

        const raw = await fs.readFile(filePath, 'utf8')
        const parsed = parsePreferenceImport(raw)

        if (!parsed.ok) {
          throw new Error(parsed.error)
        }

        electronStore.setAll({
          ...electronStore.getAll(),
          ...parsed.preferences,
        })

        return { applied: Object.keys(parsed.preferences) }
      },
    )

    // Show save dialog and return the selected path only (no file copy)
    ipcMain.handle(
      'show-save-dialog-path',
      async (_, options = {}) => {
        const res = await dialog
          .showSaveDialog(options)
          .catch(e => console.warn(e))
        if (res?.canceled || !res?.filePath) {
          return null
        }
        return res.filePath
      },
    )

    // Get system temporary directory
    ipcMain.handle('get-temp-path', async () => {
      try {
        const tempDir = app.getPath('temp')
        // Create app-specific temp directory
        const appTempDir = path.join(tempDir, 'escrcpy-preview')
        await fs.ensureDir(appTempDir)
        return appTempDir
      }
      catch (error) {
        console.error('IPC get-temp-path error:', error.message)
        throw error
      }
    })

    // Rename temporary file
    ipcMain.handle('rename-temp-file', async (_, { oldPath, newPath }) => {
      try {
        if (!oldPath || !newPath) {
          throw new Error('Both oldPath and newPath are required')
        }

        // Ensure files are within temp directory (safety check)
        const tempDir = app.getPath('temp')
        const appTempDir = path.join(tempDir, 'escrcpy-preview')

        if (!oldPath.startsWith(appTempDir) || !newPath.startsWith(appTempDir)) {
          throw new Error('File paths must be within the app temp directory')
        }

        // Check source file exists
        const exists = await fs.pathExists(oldPath)
        if (!exists) {
          throw new Error('Source file does not exist')
        }

        // Perform rename
        await fs.rename(oldPath, newPath)

        return { success: true, newPath }
      }
      catch (error) {
        console.error('IPC rename-temp-file error:', error.message)
        throw error
      }
    })

    // Navigate to route
    ipcMain.handle('navigate-to-route', async (event, route) => {
      const win = mainApp.getMainWindow()

      if (isWindowDestroyed(win)) {
        return false
      }

      try {
        win.show()
        win.webContents.send('navigate-to-route', route)
        return true
      }
      catch (error) {
        console.error('IPC navigate-to-route error:', error.message)
        return false
      }
    })

    ipcMain.handle('open-log-path', async (event) => {
      try {
        await openLogPath()
        return true
      }
      catch (error) {
        console.error('IPC open-log-path error:', error.message)
        return false
      }
    })

    ipcMain.handle('open-system-menu', (event, args = {}) => {
      const win = BrowserWindow.fromWebContents(event.sender)

      if (isWindowDestroyed(win)) {
        return false
      }

      const { options = [], channel = 'system-menu-click' } = args

      const template = options.map((item) => {
        return {
          label: item.label,
          enabled: item.enabled ?? !item.disabled,
          click() {
            if (isWindowDestroyed(win)) {
              return false
            }

            try {
              win.webContents.send(channel, item.value, item)
            }
            catch (error) {
              console.warn(`[Handles] Failed to send ${channel}:`, error.message)
            }
          },
        }
      })

      const menu = Menu.buildFromTemplate(template)
      menu.popup(win)

      return true
    })

    // Keymap: track which device's control window is focused
    ipcMain.handle('keymap:set-focused-device', async (_, serial) => {
      mainApp.emit('keymap:set-focused-device', serial)
      return true
    })

    // Keymap: execute a binding/profile for testing
    ipcMain.handle('keymap:execute', async (_, { serial, binding, profile }) => {
      try {
        const { executeKeymapProfile } = await import('$renderer/utils/keymap/index.js')
        const { getAdbPath } = await import('$electron/configs/which/index.js')
        const { setupEnvPath } = await import('$electron/process/helper.js')
        const { Adb } = await import('@devicefarmer/adbkit')
        const { assertSafeSerial, assertSafeShellArgument } = await import('$electron/helpers/shell/safe-args.js')

        setupEnvPath()
        const adbClient = Adb.createClient({ bin: getAdbPath() })

        await executeKeymapProfile(profile, serial, {
          exec: async (id, command) => {
            assertSafeSerial(id)
            if (command.startsWith('input ')) {
              // input commands are safe
            }
            else {
              assertSafeShellArgument(command, 'keymap shell command')
            }
            const stream = await adbClient.getDevice(id).shell(command)
            await Adb.util.readAll(stream)
          },
        })

        return { success: true }
      }
      catch (error) {
        console.warn('[keymap] Execute failed:', error?.message || error)
        return { success: false, error: error?.message || String(error) }
      }
    })

    // Keymap: import profile with validation
    ipcMain.handle('keymap:import', async (_, filePath) => {
      try {
        const { validateKeymapBinding } = await import('$renderer/utils/keymap/index.js')
        const fs = await import('fs-extra')
        const raw = await fs.readFile(filePath, 'utf8')
        const profile = JSON.parse(raw)

        if (!profile || typeof profile !== 'object') {
          return { success: false, error: 'Invalid profile format' }
        }

        if (!Array.isArray(profile.bindings)) {
          return { success: false, error: 'Profile must have bindings array' }
        }

        for (const binding of profile.bindings) {
          const err = validateKeymapBinding(binding)
          if (err) {
            return { success: false, error: `Invalid binding: ${err}` }
          }
        }

        // Generate new IDs to avoid conflicts
        const sanitizedProfile = {
          ...profile,
          id: `profile_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: `${profile.name || 'Imported'} (imported)`,
          bindings: profile.bindings.map(b => ({
            ...b,
            id: `binding_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          })),
        }

        return { success: true, profile: sanitizedProfile }
      }
      catch (error) {
        console.warn('[keymap] Import failed:', error?.message || error)
        return { success: false, error: error?.message || String(error) }
      }
    })

    return () => {
      ipcMain.removeHandler('show-open-dialog')
      ipcMain.removeHandler('open-path')
      ipcMain.removeHandler('show-item-in-folder')
      ipcMain.removeHandler('get-primary-display')
      ipcMain.removeHandler('show-save-dialog')
      ipcMain.removeHandler('show-save-dialog-path')
      ipcMain.removeHandler('import-preference')
      ipcMain.removeHandler('get-temp-path')
      ipcMain.removeHandler('rename-temp-file')
      ipcMain.removeHandler('navigate-to-route')
      ipcMain.removeHandler('open-log-path')
      ipcMain.removeHandler('open-system-menu')
      ipcMain.removeHandler('keymap:set-focused-device')
      ipcMain.removeHandler('keymap:execute')
      ipcMain.removeHandler('keymap:import')
    }
  },
}
