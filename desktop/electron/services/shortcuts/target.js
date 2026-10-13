/**
 * Pure shortcut-target selection for the shortcuts service.
 * Dependency-free so it stays unit-testable in plain Node (vitest).
 */

/**
 * Normalize serial inputs to a deduped string list, preserving order.
 * @param {Array<string|number|null|undefined>} values
 * @returns {string[]}
 */
export function toSerialList(values) {
  const seen = new Set()
  const out = []
  for (const value of values || []) {
    if (value === null || value === undefined) {
      continue
    }
    const serial = String(value)
    if (!serial || seen.has(serial)) {
      continue
    }
    seen.add(serial)
    out.push(serial)
  }
  return out
}

/**
 * Pick the device a shortcut should target: the frontmost mirror window
 * wins, then explicit focus while still mirrored, otherwise the most
 * recently started mirror still active. Never invents a target outside the
 * active set.
 * @param {{ focusedDeviceSerial?: string|null, foregroundSerial?: string|null, activeSerials?: Array<string>, fallbackSerial?: string|null }} state
 * @returns {string|null}
 */
export function selectTargetSerial({ focusedDeviceSerial, foregroundSerial, activeSerials, fallbackSerial } = {}) {
  const actives = toSerialList(activeSerials)
  if (actives.length === 0) {
    return null
  }
  const foreground = foregroundSerial ? String(foregroundSerial) : null
  if (foreground && actives.includes(foreground)) {
    return foreground
  }
  const focused = focusedDeviceSerial ? String(focusedDeviceSerial) : null
  if (focused && actives.includes(focused)) {
    return focused
  }
  const fallback = fallbackSerial ? String(fallbackSerial) : null
  if (fallback && actives.includes(fallback)) {
    return fallback
  }
  return actives[actives.length - 1]
}

/**
 * Whether OS-wide shortcuts may be registered right now.
 * Gated (default) mode allows registration only while a scrcpy mirror
 * window is frontmost. App focus alone never activates: keys pressed in the
 * main window (inputs, terminal, binding capture) belong to the app, and
 * anything else (browser, …) must receive its keys untouched.
 * @param {{ activeCount?: number, targetSerial?: string|null, isAppFocused?: boolean, isMirrorForeground?: boolean, globalEnabled?: boolean }} state
 * @returns {boolean}
 */
export function shouldActivateShortcuts({ activeCount, targetSerial, isMirrorForeground, globalEnabled } = {}) {
  if ((activeCount || 0) <= 0 || !targetSerial) {
    return false
  }
  if (globalEnabled) {
    return true
  }
  return isMirrorForeground === true
}
