import { app, BrowserWindow, globalShortcut } from 'electron'
import { Adb } from '@devicefarmer/adbkit'
import electronStore from '$electron/helpers/store/index.js'
import { getAdbPath } from '$electron/configs/which/index.js'
import { setupEnvPath } from '$electron/process/helper.js'
import { assertSafeSerial, assertSafeShellArgument } from '$electron/helpers/shell/safe-args.js'
import {
  executeKeymapProfile,
  getActiveProfile,
  resolveKeyeventCode,
} from '$renderer/utils/keymap/index.js'
import {
  selectTargetSerial,
  shouldActivateShortcuts,
} from './target.js'
import { probeForeground } from './foreground.js'

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
  if (electronStore.get('common.mirrorShortcutsGlobal') === undefined) {
    electronStore.set('common.mirrorShortcutsGlobal', false)
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
    let lastMirrorSerial = null
    const activeMirrorCounts = new Map()
    const activeMirrorOrder = []

    function isActiveMirror(serial) {
      return (activeMirrorCounts.get(String(serial)) || 0) > 0
    }

    function activeMirrorCount() {
      let n = 0
      activeMirrorCounts.forEach(count => (count > 0) && n++)
      return n
    }

    function addActiveMirror(serial) {
      const key = String(serial)
      activeMirrorCounts.set(key, (activeMirrorCounts.get(key) || 0) + 1)
      const index = activeMirrorOrder.indexOf(key)
      if (index !== -1) {
        activeMirrorOrder.splice(index, 1)
      }
      activeMirrorOrder.push(key)
      lastMirrorSerial = key
    }

    function removeActiveMirror(serial) {
      if (serial) {
        const key = String(serial)
        const next = (activeMirrorCounts.get(key) || 1) - 1
        if (next <= 0) {
          activeMirrorCounts.delete(key)
          const index = activeMirrorOrder.indexOf(key)
          if (index !== -1) {
            activeMirrorOrder.splice(index, 1)
          }
        }
        else {
          activeMirrorCounts.set(key, next)
        }
        if (lastMirrorSerial === key && !isActiveMirror(key)) {
          lastMirrorSerial = activeMirrorOrder.length > 0
            ? activeMirrorOrder[activeMirrorOrder.length - 1]
            : null
        }
      }
      else {
        activeMirrorCounts.clear()
        activeMirrorOrder.length = 0
        lastMirrorSerial = null
      }
    }
    let isAppFocused = (BrowserWindow.getFocusedWindow() != null)
    // True while a scrcpy mirror window (external native process) is the OS
    // foreground window. Needed because focusing a mirror fires
    // `browser-window-blur`, which would otherwise unregister hotkeys exactly
    // when the user is interacting with the mirror.
    let isMirrorForeground = false
    let foregroundSerial = null
    let foregroundTimer = null
    const FOREGROUND_POLL_MS = 500
    const keymapExecutionTimers = new Map() // accelerator -> timeout for rate limiting
    const KEYMAP_EXECUTION_COOLDOWN = 300 // ms

    function isGlobalShortcutsEnabled() {
      return electronStore.get('common.mirrorShortcutsGlobal') === true
    }

    function getActiveTargetSerial() {
      return selectTargetSerial({
        focusedDeviceSerial,
        foregroundSerial,
        activeSerials: activeMirrorOrder,
        fallbackSerial: lastMirrorSerial,
      })
    }

    /**
     * Shortcuts may only steal OS keys while a device is actively mirrored
     * AND (a mirror window is frontmost OR the user explicitly opted into
     * global mode). App focus alone never activates: main-window keys
     * (inputs, terminal, binding capture) belong to the app, and anything
     * else (browser, …) must receive its keys untouched.
     */
    function shouldShortcutsBeActive() {
      return shouldActivateShortcuts({
        activeCount: activeMirrorCount(),
        targetSerial: getActiveTargetSerial(),
        isAppFocused,
        isMirrorForeground,
        globalEnabled: isGlobalShortcutsEnabled(),
      })
    }

    /**
     * Poll the OS foreground window, but only while it can change the
     * outcome: mirrors active and gated mode. Zero cost when idle
     * (no mirrors) or in global opt-in (always on). Runs regardless of app
     * focus: focusing the app must deactivate, focusing a mirror must
     * activate, and both transitions go through here.
     */
    async function pollForegroundOnce() {
      if (activeMirrorCount() === 0 || isGlobalShortcutsEnabled()) {
        return
      }
      const { isMirrorForeground: front, foregroundSerial: serial, unavailable } = await probeForeground(activeMirrorOrder)
      // A dead probe is otherwise invisible (active-win stubs to undefined):
      // warn once so "hotkeys never fire" is diagnosable from the console.
      if (unavailable && !pollForegroundOnce._warned) {
        pollForegroundOnce._warned = true
        console.warn('[shortcuts] foreground detection unavailable (active-win has no usable native binding); mirror hotkeys stay off until the Global switch is enabled')
      }
      if (front !== isMirrorForeground || (serial || null) !== (foregroundSerial || null)) {
        isMirrorForeground = front
        foregroundSerial = serial || null
        refreshShortcutRegistration()
      }
    }

    function ensureForegroundPolling() {
      const needed = activeMirrorCount() > 0 && !isGlobalShortcutsEnabled()
      if (needed && !foregroundTimer) {
        // Immediate check so mirror focus takes effect without waiting a tick.
        pollForegroundOnce()
        foregroundTimer = setInterval(() => {
          pollForegroundOnce().catch(() => {})
        }, FOREGROUND_POLL_MS)
        if (typeof foregroundTimer.unref === 'function') {
          foregroundTimer.unref()
        }
      }
      else if (!needed && foregroundTimer) {
        clearInterval(foregroundTimer)
        foregroundTimer = null
      }
      if (!needed && (isMirrorForeground || foregroundSerial)) {
        isMirrorForeground = false
        foregroundSerial = null
      }
    }

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
        assertSafeSerial(serial)
        const code = resolveKeyeventCode(keyevent)
        if (code === null) {
          console.warn(`[shortcuts] Invalid keyevent: ${keyevent}`)
          return
        }
        const stream = await getAdbClient().getDevice(serial).shell(`input keyevent ${code}`)
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

    // Shift+= / Shift+- fail on many Windows layouts; Alt+Arrow is reliable
    const RESOLUTION_UP_ACCELS = ['CommandOrControl+Alt+Up']
    const RESOLUTION_DOWN_ACCELS = ['CommandOrControl+Alt+Down']
    const registeredResolutionShortcuts = new Set()

    function clampMaxSize(value) {
      return Math.min(4096, Math.max(320, Math.round(value)))
    }

    function adjustMirrorMaxSize(factor) {
      if (!shouldShortcutsBeActive()) {
        return
      }
      const serial = getActiveTargetSerial()
      if (!serial) {
        console.warn('[shortcuts] No active mirrored device for resolution adjust')
        return
      }

      const scrcpyRoot = electronStore.get('scrcpy') || {}
      const globalData = scrcpyRoot.global || {}
      const deviceData = scrcpyRoot[serial] || {}
      const current = Number(deviceData['--max-size'] ?? globalData['--max-size']) || 1920
      const next = clampMaxSize(factor > 1 ? current * 1.5 : current / 1.5)

      electronStore.set(['scrcpy', serial], {
        ...deviceData,
        '--max-size': next,
      })

      const mainWindow = mainApp.getMainWindow()
      mainWindow?.webContents?.send('hotkey:mirror-max-size', {
        deviceId: serial,
        maxSize: next,
        previous: current,
      })
    }

    function unregisterResolutionShortcuts() {
      registeredResolutionShortcuts.forEach((accelerator) => {
        globalShortcut.unregister(accelerator)
      })
      registeredResolutionShortcuts.clear()
    }

    function registerResolutionShortcuts() {
      unregisterResolutionShortcuts()

      for (const accelerator of RESOLUTION_UP_ACCELS) {
        const success = globalShortcut.register(accelerator, () => adjustMirrorMaxSize(1.5))
        if (success) {
          registeredResolutionShortcuts.add(accelerator)
        }
        else {
          console.warn(`[shortcuts] Failed to register resolution up: ${accelerator}`)
        }
      }

      for (const accelerator of RESOLUTION_DOWN_ACCELS) {
        const success = globalShortcut.register(accelerator, () => adjustMirrorMaxSize(1 / 1.5))
        if (success) {
          registeredResolutionShortcuts.add(accelerator)
        }
        else {
          console.warn(`[shortcuts] Failed to register resolution down: ${accelerator}`)
        }
      }
    }

    function registerMirrorShortcuts() {
      unregisterMirrorShortcuts()

      const shortcuts = electronStore.get('common.mirrorShortcuts') || []

      shortcuts.forEach((item) => {
        if (!item?.accelerator || !item?.keyevent) {
          return
        }

        const success = globalShortcut.register(item.accelerator, () => {
          // Defense in depth: never send when gated off, even if unregister raced.
          if (!shouldShortcutsBeActive()) {
            return
          }
          const serial = getActiveTargetSerial()
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
            if (!shouldShortcutsBeActive()) {
              return
            }
            // Rate limiting: prevent rapid-fire execution
            const now = Date.now()
            const lastExecution = keymapExecutionTimers.get(accelerator) || 0
            if (now - lastExecution < KEYMAP_EXECUTION_COOLDOWN) {
              return
            }
            keymapExecutionTimers.set(accelerator, now)

            // Strict target: binding device (if still mirroring) else focused mirrored device.
            // Never fall back to lastConnectedDevice.
            const candidates = [
              serial && isActiveMirror(serial) ? serial : null,
              getActiveTargetSerial(),
            ].filter(Boolean)
            const targetSerial = candidates[0] || null
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

    let lastActiveState = null

    function refreshShortcutRegistration() {
      const active = shouldShortcutsBeActive()
      if (active !== lastActiveState) {
        lastActiveState = active
        console.debug(`[shortcuts] ${active ? 'registered' : 'unregistered'} (target=${getActiveTargetSerial() || 'none'}, mirrors=${activeMirrorCount()}, focused=${isAppFocused}, mirrorFg=${isMirrorForeground})`)
      }
      if (active) {
        registerMirrorShortcuts()
        registerKeymapShortcuts()
        registerResolutionShortcuts()
      }
      else {
        unregisterMirrorShortcuts()
        unregisterKeymapShortcuts()
        unregisterResolutionShortcuts()
      }
    }

    function updateAppFocus() {
      const focused = BrowserWindow.getFocusedWindow() != null
      if (focused !== isAppFocused) {
        isAppFocused = focused
        refreshShortcutRegistration()
        ensureForegroundPolling()
      }
    }

    function handleWindowFocus() {
      isAppFocused = true
      refreshShortcutRegistration()
      ensureForegroundPolling()
    }

    function handleWindowBlur() {
      // blur fires before the next window's focus; defer so focus-switch keeps keys.
      setTimeout(updateAppFocus, 50)
    }

    function handleMirrorStarted(serial) {
      if (serial) {
        addActiveMirror(serial)
        // Adopt the mirror when nothing is explicitly focused so a missed
        // focus event can never leave hotkeys permanently dead.
        if (!focusedDeviceSerial) {
          focusedDeviceSerial = String(serial)
        }
        refreshShortcutRegistration()
        ensureForegroundPolling()
      }
    }

    function handleMirrorStopped(serial) {
      removeActiveMirror(serial)
      refreshShortcutRegistration()
      ensureForegroundPolling()
    }

    function handleFocusedDevice(serial) {
      focusedDeviceSerial = serial ? String(serial) : null
      refreshShortcutRegistration()
    }

    // IPC handler for renderer to report focused device
    mainApp.on?.('keymap:set-focused-device', handleFocusedDevice)
    mainApp.on?.('mirror:started', handleMirrorStarted)
    mainApp.on?.('mirror:stopped', handleMirrorStopped)
    app.on('browser-window-focus', handleWindowFocus)
    app.on('browser-window-blur', handleWindowBlur)

    seedDefaults()
    updateHotkey()
    updateAppFocus()
    refreshShortcutRegistration()
    ensureForegroundPolling()

    electronStore.onDidChange('common.globalHotkey', (newValue) => {
      registerHotkey(newValue)
    })

    electronStore.onDidChange('common.mirrorShortcuts', () => {
      refreshShortcutRegistration()
    })

    electronStore.onDidChange('common.mirrorShortcutsGlobal', () => {
      refreshShortcutRegistration()
      ensureForegroundPolling()
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
          refreshShortcutRegistration()
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
      if (foregroundTimer) {
        clearInterval(foregroundTimer)
        foregroundTimer = null
      }
      keymapExecutionTimers.clear()
      mainApp.off?.('keymap:set-focused-device', handleFocusedDevice)
      mainApp.off?.('mirror:started', handleMirrorStarted)
      mainApp.off?.('mirror:stopped', handleMirrorStopped)
      app.removeListener('browser-window-focus', handleWindowFocus)
      app.removeListener('browser-window-blur', handleWindowBlur)
      if (registeredHotkey) {
        globalShortcut.unregister(registeredHotkey)
      }
      unregisterMirrorShortcuts()
      unregisterKeymapShortcuts()
      unregisterResolutionShortcuts()
    }
  },
}
