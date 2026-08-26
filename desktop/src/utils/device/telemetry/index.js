/**
 * Pure device telemetry helpers: battery alert evaluation, sample ring
 * buffers, and dependency-free sparkline path building.
 */

export const TELEMETRY_DEFAULTS = {
  maxSamples: 60,
  lowBatteryPercent: 20,
  hotTemperatureCelsius: 45,
}

/**
 * @param {{ batteryPercentage?: number, temperatureCelsius?: number }} [battery]
 * @param {{ lowBatteryPercent?: number, hotTemperatureCelsius?: number }} [thresholds]
 * @returns {Array<'low'|'hot'>}
 */
export function evaluateBatteryAlerts(battery, thresholds = {}) {
  if (!battery) {
    return []
  }

  const lowBatteryPercent = thresholds.lowBatteryPercent
    ?? TELEMETRY_DEFAULTS.lowBatteryPercent
  const hotTemperatureCelsius = thresholds.hotTemperatureCelsius
    ?? TELEMETRY_DEFAULTS.hotTemperatureCelsius

  const alerts = []
  const level = Number(battery.batteryPercentage)

  if (Number.isFinite(level) && level > 0 && level <= lowBatteryPercent) {
    alerts.push('low')
  }

  const temperature = Number(battery.temperatureCelsius)

  if (Number.isFinite(temperature) && temperature >= hotTemperatureCelsius) {
    alerts.push('hot')
  }

  return alerts
}

/**
 * Fixed-capacity FIFO of samples (oldest dropped first).
 * @param {number} [maxSamples]
 */
export function createSampleRing(maxSamples = TELEMETRY_DEFAULTS.maxSamples) {
  let items = []

  return {
    push(sample) {
      items.push({ ...sample, ts: sample?.ts ?? Date.now() })

      if (items.length > maxSamples) {
        items = items.slice(items.length - maxSamples)
      }
    },

    size() {
      return items.length
    },

    toArray() {
      return [...items]
    },

    clear() {
      items = []
    },
  }
}

/**
 * Builds an SVG polyline `d` attribute from numeric values.
 * Non-finite values are skipped; needs two finite points to draw.
 * @param {number[]} values
 * @param {{ width?: number, height?: number }} [box]
 * @returns {string} path data or '' when nothing drawable
 */
export function buildSparklinePath(values = [], { width = 100, height = 24 } = {}) {
  const points = (values || [])
    .map(Number)
    .filter(value => Number.isFinite(value))

  if (points.length < 2) {
    return ''
  }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min

  const stepX = points.length > 1 ? (width - 1) / (points.length - 1) : 0

  return points
    .map((value, index) => {
      const x = index * stepX
      const normalized = span === 0 ? 0.5 : (value - min) / span
      const y = (height - 1) - normalized * (height - 1)
      return `${index === 0 ? 'M' : 'L'}${round(x)},${round(y)}`
    })
    .join(' ')
}

function round(value) {
  return Math.round(value * 100) / 100
}
