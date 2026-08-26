/**
 * Pure automation core: validates scheduled step lists and converts them
 * into adb shell commands. No Electron or component dependencies, so the
 * whole module stays unit-testable (see desktop/test/automation.test.js).
 */

export const AutomationStepType = {
  TAP: 'tap',
  SWIPE: 'swipe',
  TEXT: 'text',
  KEY: 'key',
  WAIT: 'wait',
  COMMAND: 'command',
}

export const AUTOMATION_KEYCODES = {
  HOME: 3,
  BACK: 4,
  MENU: 82,
  POWER: 26,
  VOLUME_UP: 24,
  VOLUME_DOWN: 25,
  ENTER: 66,
  DEL: 67,
  RECENT_APPS: 187,
}

const TEXT_UNSAFE_PATTERN = /['"\\;$&|<>()`^%!?*]/

function toFiniteNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function isNonNegativeNumber(value) {
  const numeric = toFiniteNumber(value)
  return numeric !== null && numeric >= 0
}

/**
 * Android `input text` cannot receive raw spaces (they terminate the
 * argument) and chokes on shell metacharacters, so whitespace becomes `%s`
 * and unsafe characters are dropped.
 * @param {string} value
 * @returns {string}
 */
export function normalizeTextForInput(value) {
  return String(value ?? '')
    .split('')
    .filter(char => !TEXT_UNSAFE_PATTERN.test(char))
    .join('')
    .trim()
    .replace(/\s+/g, '%s')
}

/**
 * @param {{ type: string, x?: number, y?: number, startX?: number, startY?: number, endX?: number, endY?: number, duration?: number, value?: string, code?: number|string, ms?: number }} step
 * @returns {string|null} adb shell command, or null for wait steps
 * @throws {Error} for unsupported step types or unknown key names
 */
export function buildDeviceCommand(step) {
  const { type } = step

  switch (type) {
    case AutomationStepType.TAP: {
      const x = toFiniteNumber(step.x)
      const y = toFiniteNumber(step.y)

      if (x === null || y === null) {
        throw new Error(`Invalid tap coordinates: ${step.x}, ${step.y}`)
      }

      return `input tap ${x} ${y}`
    }

    case AutomationStepType.SWIPE: {
      const startX = toFiniteNumber(step.startX)
      const startY = toFiniteNumber(step.startY)
      const endX = toFiniteNumber(step.endX)
      const endY = toFiniteNumber(step.endY)

      if (startX === null || startY === null || endX === null || endY === null) {
        throw new Error(`Invalid swipe coordinates: ${step.startX}, ${step.startY}, ${step.endX}, ${step.endY}`)
      }

      const base = `input swipe ${startX} ${startY} ${endX} ${endY}`
      const duration = toFiniteNumber(step.duration)
      return duration > 0 ? `${base} ${duration}` : base
    }

    case AutomationStepType.TEXT:
      return `input text ${normalizeTextForInput(step.value)}`

    case AutomationStepType.KEY: {
      const code = typeof step.code === 'string'
        ? AUTOMATION_KEYCODES[step.code]
        : toFiniteNumber(step.code)

      if (code === undefined || code === null) {
        throw new Error(`Unknown key code: ${step.code}`)
      }

      return `input keyevent ${code}`
    }

    case AutomationStepType.WAIT:
      return null

    case AutomationStepType.COMMAND:
      return String(step.value ?? '').replace(/^shell\s+/i, '').trim()

    default:
      throw new Error(`Unsupported automation step type: ${type}`)
  }
}

/**
 * @param {Array<Object>} steps
 * @returns {string|null} first validation problem, or null when valid
 */
export function validateAutomationSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return 'Automation steps are empty'
  }

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index] || {}
    const label = `step #${index}`

    switch (step.type) {
      case AutomationStepType.TAP:
        if (!isNonNegativeNumber(step.x) || !isNonNegativeNumber(step.y)) {
          return `Invalid coordinates at ${label} (${step.type})`
        }
        break

      case AutomationStepType.SWIPE:
        if (
          !isNonNegativeNumber(step.startX)
          || !isNonNegativeNumber(step.startY)
          || !isNonNegativeNumber(step.endX)
          || !isNonNegativeNumber(step.endY)
        ) {
          return `Invalid coordinates at ${label} (${step.type})`
        }
        if (step.duration !== undefined && !isNonNegativeNumber(step.duration)) {
          return `Invalid duration at ${label} (${step.type})`
        }
        break

      case AutomationStepType.TEXT:
        if (!String(step.value ?? '').trim()) {
          return `Empty text at ${label} (${step.type})`
        }
        break

      case AutomationStepType.KEY: {
        const known = typeof step.code === 'string'
          ? step.code in AUTOMATION_KEYCODES
          : isNonNegativeNumber(step.code)

        if (!known) {
          return `Invalid key code at ${label} (${step.type})`
        }
        break
      }

      case AutomationStepType.WAIT:
        if (!isNonNegativeNumber(step.ms) || toFiniteNumber(step.ms) <= 0) {
          return `Invalid wait duration at ${label} (${step.type})`
        }
        break

      case AutomationStepType.COMMAND:
        if (!String(step.value ?? '').trim()) {
          return `Empty command at ${label} (${step.type})`
        }
        break

      default:
        return `Unknown step type at ${label}: ${step.type}`
    }
  }

  return null
}

/**
 * Runs a validated step list sequentially against one device.
 * @param {Array<Object>} steps
 * @param {Object} options
 * @param {string} options.deviceId
 * @param {(deviceId: string, command: string) => Promise<any>} [options.exec]
 * @param {(ms: number) => Promise<void>} [options.sleepFn]
 * @returns {Promise<{ executed: number, waited: number }>}
 * @throws {Error} when the step list is invalid or a command fails
 */
export async function runAutomationSteps(steps, {
  deviceId,
  exec = (id, command) => window.$preload.adb.deviceShell(id, command),
  sleepFn = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  const problem = validateAutomationSteps(steps)

  if (problem) {
    throw new Error(problem)
  }

  let executed = 0
  let waited = 0

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index]

    try {
      if (step.type === AutomationStepType.WAIT) {
        await sleepFn(toFiniteNumber(step.ms))
        waited++
        continue
      }

      await exec(deviceId, buildDeviceCommand(step))
      executed++
    }
    catch (error) {
      throw new Error(
        `Automation failed at step #${index} (${step.type}): ${error?.message || error}`,
      )
    }
  }

  return { executed, waited }
}
