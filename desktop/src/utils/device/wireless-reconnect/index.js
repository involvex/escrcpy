/**
 * Wireless auto-reconnect helpers.
 *
 * The device view already retries every Wi-Fi history address on launch;
 * these utilities add an address filter and a persisted failure counter so
 * dead addresses stop being retried after a configurable number of
 * consecutive failures (a success or manual connect clears them).
 */

const WIRELESS_ADDRESS_PATTERN = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[\w-]+(?:\.[\w-]+)*|\[[^\]]+\]):\d{1,5}$/

/**
 * Whether the id looks like a `host:port` address that `adb connect` can use.
 * USB serials and mDNS discovery names do not qualify.
 * @param {string} id
 * @returns {boolean}
 */
export function isWirelessAddress(id) {
  return typeof id === 'string' && WIRELESS_ADDRESS_PATTERN.test(id)
}

/**
 * Failure-counter state machine for reconnect attempts.
 * Counters survive restarts via the load/save hooks.
 *
 * @param {Object} [options]
 * @param {number|null} [options.maxFailures] consecutive failures before an
 *   address is skipped; defaults to 3. Zero or negative disables attempts,
 *   while null means unlimited.
 * @param {() => Record<string, number>} [options.load]
 * @param {(value: Record<string, number>) => void} [options.save]
 */
export function createWirelessReconnectTracker({
  maxFailures = 3,
  load = () => ({}),
  save = () => {},
} = {}) {
  let failures = { ...(load?.() || {}) }

  const hasLimit = maxFailures !== null
  const limitValue = Number(maxFailures)

  return {
    canAttempt(id) {
      if (!hasLimit) {
        return true
      }

      if (!Number.isFinite(limitValue) || limitValue <= 0) {
        return false
      }

      return (failures[id] || 0) < limitValue
    },

    recordFailure(id) {
      failures = {
        ...failures,
        [id]: (failures[id] || 0) + 1,
      }
      save?.(failures)
      return failures[id]
    },

    recordSuccess(id) {
      const { [id]: _cleared, ...rest } = failures
      failures = rest
      save?.(failures)
    },

    reset() {
      failures = {}
      save?.(failures)
    },
  }
}
