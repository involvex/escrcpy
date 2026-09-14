import { app, globalShortcut } from 'electron'
import { Adb } from '@devicefarmer/adbkit'
import electronStore from '$electron/helpers/store/index.js'
import { getAdbPath } from '$electron/configs/which/index.js'
import { setupEnvPath } from '$electron/process/helper.js'
import { assertSafeSerial, assertSafeShellArgument } from '$electron/helpers/shell/safe-args.js'
import {
  executeKeymapProfile,
  getActiveProfile,
} from '$renderer/utils/keymap/index.js'

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
  deps: ['module:main', 'service:handles'],
  async apply(mainApp) {
    let registeredHotkey = null
    const registeredMirrorShortcuts = new Map()
    const keymapShortcuts = new Map() // accelerator -> { serial, binding }
    let focusedDeviceSerial = null
    const keymapExecutionTimers = new Map() // accelerator -> timeout for rate limiting
    const KEYMAP_EXECUTION_COOLDOWN = 300 // ms

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
          const serial = focusedDeviceSerial || electronStore.get('lastConnectedDevice')?.id
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

    // --- Keymap support ---

    function unregisterKeymapShortcuts() {
      keymapShortcuts.forEach((_, accelerator) => {
        globalShortcut.unregister(accelerator)
      })
      keymapShortcuts.clear()
    }

    function registerKeymapShortcuts() {
      unregisterKeymapShortcuts()

      // Get all keymap data (global + per-device)
      const globalKeymap = electronStore.get('keymap.global')
      const allKeymaps = { ...globalKeymap }

      // Add per-device keymaps
      const storeKeys = electronStore.getAll ? Object.keys(electronStore.getAll()) : []
      storeKeys.forEach((key) => {
        if (key.startsWith('keymap.') && key !== 'keymap.global') {
          allKeymaps[key] = electronStore.get(key)
        }
      })

      for (const [key, keymapData] of Object.entries(allKeymaps)) {
        if (!keymapData)
          continue
        const profile = getActiveProfile(keymapData)
        if (!profile || !Array.isArray(profile.bindings))
          continue

        const serial = key === 'keymap.global' ? null : key.replace('keymap.', '')

        for (const binding of profile.bindings) {
          if (!binding.enabled || !binding.key)
            continue

          const accelerator = binding.key
          if (!accelerator)
            continue

          // Skip if already registered (first one wins)
          if (keymapShortcuts.has(accelerator)) {
            console.warn(`[shortcuts] Keymap shortcut conflict: ${accelerator} already registered`)
            continue
          }

          const success = globalShortcut.register(accelerator, () => {
            // Rate limiting: prevent rapid-fire execution
            const now = Date.now()
            const lastExecution = keymapExecutionTimers.get(accelerator) || 0
            if (now - lastExecution < KEYMAP_EXECUTION_COOLDOWN) {
              return
            }
            keymapExecutionTimers.set(accelerator, now)

            // Determine target serial: binding's serial > focused device > last connected
            const targetSerial = serial || focusedDeviceSerial || electronStore.get('lastConnectedDevice')?.id
            if (targetSerial) {
              executeKeymapForSerial(targetSerial, profile)
            }
          })

          if (success) {
            keymapShortcuts.set(accelerator, { serial, binding, profile })
          }
          else {
            console.warn(`[shortcuts] Failed to register keymap shortcut: ${accelerator}`)
          }
        }
      }
    }

    async function executeKeymapForSerial(serial, profile) {
      try {
        await executeKeymapProfile(profile, serial, {
          exec: async (id, command) => {
            assertSafeSerial(id)
            if (command.startsWith('input ')) {
              // input commands are safe
            }
            else {
              assertSafeShellArgument(command, 'keymap shell command')
            }
            const stream = await getAdbClient().getDevice(id).shell(command)
            await Adb.util.readAll(stream)
          },
        })
      }
      catch (error) {
        console.warn(`[shortcuts] Failed to execute keymap for ${serial}:`, error?.message || error)
      }
    }

    // IPC handler for renderer to report focused device
    mainApp.on?.('keymap:set-focused-device', (serial) => {
      focusedDeviceSerial = serial
      // Re-register mirror shortcuts to use the new focused device
      registerMirrorShortcuts()
    })

    seedDefaults()
    updateHotkey()
    registerMirrorShortcuts()
    registerKeymapShortcuts()

    electronStore.onDidChange('common.globalHotkey', (newValue) => {
      registerHotkey(newValue)
    })

    electronStore.onDidChange('common.mirrorShortcuts', () => {
      registerMirrorShortcuts()
    })

    // Watch for keymap changes with debounced re-registration
    let keymapChangeTimer = null
    let lastKeymapState = null

    function getKeymapState() {
      const globalKeymap = electronStore.get('keymap.global')
      const storeAll = electronStore.getAll?.() || {}
      const perDeviceKeymaps = {}
      Object.keys(storeAll).forEach((key) => {
        if (key.startsWith('keymap.') && key !== 'keymap.global') {
          perDeviceKeymaps[key] = storeAll[key]
        }
      })
      return JSON.stringify({ global: globalKeymap, devices: perDeviceKeymaps })
    }

    function scheduleKeymapReregister() {
      if (keymapChangeTimer) {
        clearTimeout(keymapChangeTimer)
      }
      keymapChangeTimer = setTimeout(() => {
        const currentState = getKeymapState()
        if (currentState !== lastKeymapState) {
          lastKeymapState = currentState
          registerKeymapShortcuts()
        }
      }, 50)
    }

    lastKeymapState = getKeymapState()

    const keymapKeys = ['keymap.global']
    const storeAll = electronStore.getAll?.()
    if (storeAll) {
      Object.keys(storeAll).forEach((key) => {
        if (key.startsWith('keymap.') && key !== 'keymap.global') {
          keymapKeys.push(key)
        }
      })
    }

    keymapKeys.forEach((key) => {
      electronStore.onDidChange(key, () => {
        scheduleKeymapReregister()
      })
    })

    return () => {
      if (keymapChangeTimer) {
        clearTimeout(keymapChangeTimer)
      }
      keymapExecutionTimers.clear()
      if (registeredHotkey) {
        globalShortcut.unregister(registeredHotkey)
      }
      unregisterMirrorShortcuts()
      unregisterKeymapShortcuts()
    }
  },
}
