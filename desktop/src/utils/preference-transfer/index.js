/**
 * Pure validation for preference config import/export.
 *
 * The app's existing export copies the raw electron-store file, so an
 * imported payload may be either that raw dump or a wrapped transfer
 * envelope. Either way, only known top-level preference keys with plain
 * object values may reach the live store.
 */

export const PREFERENCE_TRANSFER_KEYS = [
  'common',
  'video',
  'device',
  'window',
  'launch',
  'audio',
  'record',
  'input',
  'camera',
  'copilot',
  'scrcpy',
]

const KNOWN_KEY_SET = new Set(PREFERENCE_TRANSFER_KEYS)

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * @param {string|Object} raw - JSON string or parsed store dump / envelope
 * @returns {{ ok: true, preferences: Record<string, Object> } | { ok: false, error: string }}
 */
export function parsePreferenceImport(raw) {
  let payload = raw

  if (typeof raw === 'string') {
    try {
      payload = JSON.parse(raw)
    }
    catch (error) {
      return { ok: false, error: `Invalid JSON file: ${error.message}` }
    }
  }

  if (!isPlainObject(payload)) {
    return { ok: false, error: 'Invalid config file: expected a JSON object' }
  }

  const source = isPlainObject(payload.preferences)
    ? payload.preferences
    : payload

  const preferences = {}

  for (const [key, value] of Object.entries(source)) {
    if (KNOWN_KEY_SET.has(key) && isPlainObject(value)) {
      preferences[key] = value
    }
  }

  if (Object.keys(preferences).length === 0) {
    return { ok: false, error: 'Invalid config file: no valid preference keys found' }
  }

  return { ok: true, preferences }
}
