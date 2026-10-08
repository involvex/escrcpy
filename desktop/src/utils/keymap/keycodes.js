/**
 * Curated Android KeyEvent table for human-readable keycode display.
 * Single source of truth for keycode <-> name <-> label mappings.
 * Codes follow AOSP `KeyEvent` (https://developer.android.com/reference/android/view/KeyEvent).
 */

/**
 * @typedef {Object} KeyeventEntry
 * @property {number} code - Numeric Android keycode
 * @property {string} name - Canonical AOSP constant name (without KEYCODE_ prefix)
 * @property {string} label - Short human-readable label
 * @property {string[]} [aliases] - Legacy/alternative names that also resolve
 */

export const KEYEVENT_LIST = [
  { code: 0, name: 'UNKNOWN', label: 'Unknown' },
  { code: 3, name: 'HOME', label: 'Home' },
  { code: 4, name: 'BACK', label: 'Back' },
  { code: 5, name: 'CALL', label: 'Call' },
  { code: 6, name: 'ENDCALL', label: 'End Call' },
  { code: 19, name: 'DPAD_UP', label: 'D-Pad Up' },
  { code: 20, name: 'DPAD_DOWN', label: 'D-Pad Down' },
  { code: 21, name: 'DPAD_LEFT', label: 'D-Pad Left' },
  { code: 22, name: 'DPAD_RIGHT', label: 'D-Pad Right' },
  { code: 23, name: 'DPAD_CENTER', label: 'D-Pad Center' },
  { code: 24, name: 'VOLUME_UP', label: 'Volume Up' },
  { code: 25, name: 'VOLUME_DOWN', label: 'Volume Down' },
  { code: 26, name: 'POWER', label: 'Power' },
  { code: 27, name: 'CAMERA', label: 'Camera' },
  { code: 61, name: 'TAB', label: 'Tab' },
  { code: 62, name: 'SPACE', label: 'Space' },
  { code: 66, name: 'ENTER', label: 'Enter' },
  { code: 67, name: 'DEL', label: 'Delete' },
  { code: 80, name: 'FOCUS', label: 'Focus' },
  { code: 82, name: 'MENU', label: 'Menu' },
  { code: 83, name: 'NOTIFICATION', label: 'Notifications' },
  { code: 84, name: 'SEARCH', label: 'Search' },
  { code: 85, name: 'MEDIA_PLAY_PAUSE', label: 'Play/Pause' },
  { code: 86, name: 'MEDIA_STOP', label: 'Stop' },
  { code: 87, name: 'MEDIA_NEXT', label: 'Next' },
  { code: 88, name: 'MEDIA_PREVIOUS', label: 'Previous' },
  { code: 89, name: 'MEDIA_REWIND', label: 'Rewind' },
  { code: 90, name: 'MEDIA_FAST_FORWARD', label: 'Fast Forward' },
  { code: 92, name: 'PAGE_UP', label: 'Page Up' },
  { code: 93, name: 'PAGE_DOWN', label: 'Page Down' },
  { code: 111, name: 'ESCAPE', label: 'Escape' },
  { code: 115, name: 'CAPS_LOCK', label: 'Caps Lock' },
  { code: 120, name: 'SYSRQ', label: 'SysRq' },
  { code: 122, name: 'MOVE_HOME', label: 'Move Home' },
  { code: 123, name: 'MOVE_END', label: 'Move End' },
  { code: 126, name: 'MEDIA_PLAY', label: 'Play' },
  { code: 127, name: 'MEDIA_PAUSE', label: 'Pause' },
  { code: 130, name: 'MEDIA_RECORD', label: 'Record' },
  { code: 164, name: 'VOLUME_MUTE', label: 'Mute' },
  { code: 187, name: 'APP_SWITCH', label: 'Recents', aliases: ['RECENT_APPS'] },
  { code: 220, name: 'BRIGHTNESS_DOWN', label: 'Brightness Down' },
  { code: 221, name: 'BRIGHTNESS_UP', label: 'Brightness Up' },
  { code: 223, name: 'SLEEP', label: 'Sleep' },
  { code: 224, name: 'WAKEUP', label: 'Wake Up' },
]

const CODE_TO_ENTRY = new Map(KEYEVENT_LIST.map(entry => [entry.code, entry]))

const NAME_TO_CODE = new Map()
for (const entry of KEYEVENT_LIST) {
  NAME_TO_CODE.set(entry.name, entry.code)
  for (const alias of entry.aliases || []) {
    if (!NAME_TO_CODE.has(alias)) {
      NAME_TO_CODE.set(alias, entry.code)
    }
  }
}

/** Canonical AOSP name -> code map (includes aliases like RECENT_APPS). */
export const KEYEVENT_CODES = Object.fromEntries(NAME_TO_CODE)

/**
 * Resolve a name, alias, or numeric value to a numeric keycode.
 * @param {string|number} value
 * @returns {number|null}
 */
export function resolveKeyeventCode(value) {
  if (typeof value === 'string') {
    const upper = value.trim().toUpperCase()
    if (!upper) {
      return null
    }
    if (NAME_TO_CODE.has(upper)) {
      return NAME_TO_CODE.get(upper)
    }
    const num = Number.parseInt(upper, 10)
    if (Number.isFinite(num) && num >= 0) {
      return num
    }
    return null
  }
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }
  return null
}

/**
 * Canonical AOSP name for a numeric keycode, or null when unknown.
 * @param {string|number} code
 * @returns {string|null}
 */
export function getKeyeventName(code) {
  const resolved = resolveKeyeventCode(code)
  if (resolved === null) {
    return null
  }
  return CODE_TO_ENTRY.get(resolved)?.name ?? null
}

/**
 * Human-readable label like `Recents (187)`; falls back to `Code 999`.
 * @param {string|number} code
 * @returns {string|null} null when the input is not a valid keycode
 */
export function getKeyeventLabel(code) {
  const resolved = resolveKeyeventCode(code)
  if (resolved === null) {
    return null
  }
  const entry = CODE_TO_ENTRY.get(resolved)
  if (entry) {
    return `${entry.label} (${entry.code})`
  }
  return `Code ${resolved}`
}

/**
 * Normalize an Electron accelerator for display (`CommandOrControl+D` -> `Ctrl+D`).
 * @param {string} accelerator
 * @returns {string}
 */
export function formatAccelerator(accelerator) {
  if (!accelerator || typeof accelerator !== 'string') {
    return ''
  }
  const isMac = typeof process !== 'undefined' && process.platform === 'darwin'
  return accelerator
    .split('+')
    .map((part) => {
      const lower = part.toLowerCase()
      if (lower === 'commandorcontrol') {
        return isMac ? 'Cmd' : 'Ctrl'
      }
      if (lower === 'command' || lower === 'cmd') {
        return 'Cmd'
      }
      if (lower === 'control' || lower === 'ctrl') {
        return 'Ctrl'
      }
      if (part.length === 1) {
        return part.toUpperCase()
      }
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join('+')
}
