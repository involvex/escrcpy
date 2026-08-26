import { describe, expect, it } from 'vitest'
import {
  buildSparklinePath,
  createSampleRing,
  evaluateBatteryAlerts,
} from '../src/utils/device/telemetry/index.js'

describe('evaluateBatteryAlerts', () => {
  it('returns no alerts for healthy readings', () => {
    expect(evaluateBatteryAlerts({ batteryPercentage: 80, temperatureCelsius: 30 })).toEqual([])
    expect(evaluateBatteryAlerts({}, {})).toEqual([])
    expect(evaluateBatteryAlerts(undefined)).toEqual([])
  })

  it('flags low battery at or below the threshold', () => {
    expect(evaluateBatteryAlerts(
      { batteryPercentage: 15 },
      { lowBatteryPercent: 20 },
    )).toEqual(['low'])

    expect(evaluateBatteryAlerts(
      { batteryPercentage: 20 },
      { lowBatteryPercent: 20 },
    )).toEqual(['low'])

    expect(evaluateBatteryAlerts(
      { batteryPercentage: 21 },
      { lowBatteryPercent: 20 },
    )).toEqual([])
  })

  it('flags overheating at or above the threshold', () => {
    expect(evaluateBatteryAlerts(
      { temperatureCelsius: 46 },
      { hotTemperatureCelsius: 45 },
    )).toEqual(['hot'])

    expect(evaluateBatteryAlerts(
      { temperatureCelsius: 45 },
      { hotTemperatureCelsius: 45 },
    )).toEqual(['hot'])
  })

  it('can combine both alerts in a stable order', () => {
    expect(evaluateBatteryAlerts(
      { batteryPercentage: 5, temperatureCelsius: 60 },
      { lowBatteryPercent: 20, hotTemperatureCelsius: 45 },
    )).toEqual(['low', 'hot'])
  })
})

describe('createSampleRing', () => {
  it('keeps only the newest samples', () => {
    const ring = createSampleRing(3)

    ring.push({ level: 1 })
    ring.push({ level: 2 })
    ring.push({ level: 3 })
    expect(ring.toArray().map(s => s.level)).toEqual([1, 2, 3])

    ring.push({ level: 4 })
    expect(ring.toArray().map(s => s.level)).toEqual([2, 3, 4])
    expect(ring.size()).toBe(3)
  })

  it('starts empty and clears cleanly', () => {
    const ring = createSampleRing(5)
    expect(ring.size()).toBe(0)

    ring.push({ level: 1 })
    expect(ring.size()).toBe(1)

    ring.clear()
    expect(ring.size()).toBe(0)
  })
})

describe('buildSparklinePath', () => {
  it('maps values onto an svg path spanning the box', () => {
    const d = buildSparklinePath([0, 10], { width: 100, height: 20 })

    expect(d).toBe('M0,19 L99,0')
  })

  it('renders flat lines without dividing by zero', () => {
    const d = buildSparklinePath([5, 5, 5], { width: 40, height: 20 })
    expect(d).toMatch(/^M\d+(\.\d+)?,\d+(\.\d+)?( L\d+(\.\d+)?,\d+(\.\d+)?)+$/)
    expect(d).not.toContain('NaN')
  })

  it('skips non-finite gaps instead of breaking the path', () => {
    const d = buildSparklinePath([1, Number.NaN, 3], { width: 60, height: 30 })
    expect(d).toBe('M0,29 L59,0')
    expect(d).not.toContain('NaN')
  })

  it('needs at least two finite points', () => {
    expect(buildSparklinePath([])).toBe('')
    expect(buildSparklinePath([7])).toBe('')
  })
})
