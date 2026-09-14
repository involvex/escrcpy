import {
  AUTOMATION_KEYCODES,
  normalizeTextForInput,
  runAutomationSteps,
  validateAutomationSteps,
} from '$/utils/automation/index.js'

/**
 * @typedef {Object} KeymapBinding
 * @property {string} id - Unique binding identifier
 * @property {string} action - One of KeymapActionType values
 * @property {Object} params - Action-specific parameters
 * @property {boolean} [enabled=true] - Whether binding is active
 * @property {string} [key] - Keyboard accelerator (e.g., "Ctrl+A")
 */

/**
 * @typedef {Object} KeymapProfile
 * @property {string} id - Unique profile identifier
 * @property {string} name - Display name
 * @property {KeymapBinding[]} bindings - Array of key bindings
 */

/**
 * @typedef {Object} KeymapData
 * @property {string} [activeProfile] - ID of active profile
 * @property {KeymapProfile[]} [profiles] - Array of profiles
 */

/**
 * @typedef {Object} KeymapStep
 * @property {string} id - Unique step identifier
 * @property {string} type - Step type (keyevent, tap, swipe, text, shell, wait)
 * @property {Object} params - Step-specific parameters
 */

export const KeymapActionType = {
  KEYEVENT: 'keyevent',
  TAP: 'tap',
  SWIPE: 'swipe',
  TEXT: 'text',
  SHELL: 'shell',
  MACRO: 'macro',
}

export const KEYEVENT_CODES = {
  ...AUTOMATION_KEYCODES,
  VOLUME_MUTE: 164,
  MEDIA_PLAY: 126,
  MEDIA_PAUSE: 127,
  MEDIA_NEXT: 87,
  MEDIA_PREVIOUS: 88,
  CAMERA: 27,
}

export function resolveKeyeventCode(code) {
  if (typeof code === 'string') {
    const upper = code.toUpperCase()
    if (KEYEVENT_CODES[upper] !== undefined) {
      return KEYEVENT_CODES[upper]
    }
    const num = parseInt(code, 10)
    if (Number.isFinite(num) && num >= 0) {
      return num
    }
  }
  if (typeof code === 'number' && Number.isFinite(code) && code >= 0) {
    return code
  }
  return null
}

export function validateKeymapBinding(binding) {
  if (!binding || typeof binding !== 'object') {
    return 'Invalid binding: not an object'
  }

  if (!binding.action || !Object.values(KeymapActionType).includes(binding.action)) {
    return `Invalid action: ${binding.action}`
  }

  const { action, params = {} } = binding

  switch (action) {
    case KeymapActionType.KEYEVENT: {
      const code = resolveKeyeventCode(params.code)
      if (code === null) {
        return 'Invalid keyevent code'
      }
      break
    }
    case KeymapActionType.TAP: {
      const x = Number(params.x)
      const y = Number(params.y)
      if (!Number.isFinite(x) || x < 0 || !Number.isFinite(y) || y < 0) {
        return 'Invalid tap coordinates'
      }
      break
    }
    case KeymapActionType.SWIPE: {
      const startX = Number(params.startX)
      const startY = Number(params.startY)
      const endX = Number(params.endX)
      const endY = Number(params.endY)
      if (
        !Number.isFinite(startX) || startX < 0
        || !Number.isFinite(startY) || startY < 0
        || !Number.isFinite(endX) || endX < 0
        || !Number.isFinite(endY) || endY < 0
      ) {
        return 'Invalid swipe coordinates'
      }
      if (params.duration !== undefined) {
        const dur = Number(params.duration)
        if (!Number.isFinite(dur) || dur < 0) {
          return 'Invalid swipe duration'
        }
      }
      break
    }
    case KeymapActionType.TEXT: {
      if (!params.text || typeof params.text !== 'string') {
        return 'Text parameter is required'
      }
      break
    }
    case KeymapActionType.SHELL: {
      if (!params.command || typeof params.command !== 'string') {
        return 'Shell command is required'
      }
      const dangerous = /[;&|$`\\]|\b(rm|mv|cp|chmod|chown|dd|mkfs|mount|umount|reboot|shutdown)\b/i
      if (dangerous.test(params.command)) {
        return 'Shell command contains prohibited patterns'
      }
      break
    }
    case KeymapActionType.MACRO: {
      if (!Array.isArray(params.steps) || params.steps.length === 0) {
        return 'Macro steps array is required'
      }
      const err = validateAutomationSteps(params.steps)
      if (err) {
        return `Invalid macro steps: ${err}`
      }
      break
    }
  }

  return null
}

export function buildKeymapCommand(binding) {
  const { action, params = {} } = binding

  switch (action) {
    case KeymapActionType.KEYEVENT: {
      const code = resolveKeyeventCode(params.code)
      return code !== null ? `input keyevent ${code}` : null
    }
    case KeymapActionType.TAP: {
      const x = Number(params.x)
      const y = Number(params.y)
      return Number.isFinite(x) && Number.isFinite(y) ? `input tap ${x} ${y}` : null
    }
    case KeymapActionType.SWIPE: {
      const startX = Number(params.startX)
      const startY = Number(params.startY)
      const endX = Number(params.endX)
      const endY = Number(params.endY)
      const base = `input swipe ${startX} ${startY} ${endX} ${endY}`
      const duration = Number(params.duration)
      return duration > 0 ? `${base} ${duration}` : base
    }
    case KeymapActionType.TEXT: {
      return `input text ${normalizeTextForInput(params.text)}`
    }
    case KeymapActionType.SHELL: {
      return params.command?.replace(/^shell\s+/i, '').trim() || null
    }
    case KeymapActionType.MACRO: {
      return 'macro' // Special marker, handled separately
    }
    default:
      return null
  }
}

export async function executeKeymapBinding(binding, {
  deviceId,
  exec = (id, command) => window.$preload?.adb?.deviceShell?.(id, command),
  sleepFn = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  const err = validateKeymapBinding(binding)
  if (err) {
    throw new Error(`Invalid binding: ${err}`)
  }

  const { action, params = {} } = binding

  if (action === KeymapActionType.MACRO) {
    return runAutomationSteps(params.steps, { deviceId, exec, sleepFn })
  }

  const command = buildKeymapCommand(binding)
  if (!command) {
    throw new Error('Failed to build command')
  }

  await exec(deviceId, command)
  return { executed: 1 }
}

export async function executeKeymapProfile(profile, deviceId, options = {}) {
  if (!profile || !Array.isArray(profile.bindings)) {
    return { executed: 0, errors: ['Invalid profile'] }
  }

  const results = []
  const errors = []

  for (const binding of profile.bindings) {
    if (binding.enabled === false)
      continue

    try {
      const result = await executeKeymapBinding(binding, { deviceId, ...options })
      results.push({ bindingId: binding.id, ...result })
    }
    catch (error) {
      errors.push({ bindingId: binding.id, error: error.message })
    }
  }

  return { executed: results.length, errors }
}

export function getActiveProfile(keymapData) {
  if (!keymapData || !Array.isArray(keymapData.profiles)) {
    return null
  }
  const activeId = keymapData.activeProfile
  if (!activeId)
    return null
  return keymapData.profiles.find(p => p.id === activeId) || null
}

export function createDefaultProfile(name = '默认方案') {
  return {
    id: `profile_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name,
    bindings: [],
  }
}

export function createDefaultBinding(action = KeymapActionType.KEYEVENT) {
  const base = {
    id: `binding_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    action,
    params: {},
    enabled: true,
  }

  switch (action) {
    case KeymapActionType.KEYEVENT:
      return { ...base, params: { code: '' } }
    case KeymapActionType.TAP:
      return { ...base, params: { x: 0, y: 0 } }
    case KeymapActionType.SWIPE:
      return { ...base, params: { startX: 0, startY: 0, endX: 0, endY: 0, duration: 300 } }
    case KeymapActionType.TEXT:
      return { ...base, params: { text: '' } }
    case KeymapActionType.SHELL:
      return { ...base, params: { command: '' } }
    case KeymapActionType.MACRO:
      return { ...base, params: { steps: [] } }
    default:
      return base
  }
}
