import { describe, expect, it } from 'vitest'
import { parseBatteryDump } from '../electron/middleware/adb/helpers/battery/index.js'

const FULL_DUMP = `Current Battery Service state:
  AC powered: true
  USB powered: false
  Wireless powered: false
  Dock powered: false
  Max charging current: 1500000
  status: 2
  health: 2
  present: true
  level: 85
  scale: 100
  voltage: 4300
  temperature: 285
  technology: Li-poly
`

describe('parseBatteryDump', () => {
  it('parses raw fields with typed and camelCase values', () => {
    const { raw } = parseBatteryDump(FULL_DUMP)
    expect(raw.acPowered).toBe(true)
    expect(raw.usbPowered).toBe(false)
    expect(raw.maxChargingCurrent).toBe(1500000)
    expect(raw.level).toBe(85)
    expect(raw.voltage).toBe(4300)
    expect(raw.temperature).toBe(285)
    expect(raw.technology).toBe('Li-poly')
  })

  it('computes derived metrics for an AC-charging device', () => {
    const { computed } = parseBatteryDump(FULL_DUMP)
    expect(computed.batteryPercentage).toBe(85)
    expect(computed.temperatureCelsius).toBe(28.5)
    expect(computed.voltageV).toBe(4.3)
    expect(computed.isCharging).toBe(true)
    expect(computed.powerSource).toBe('AC')
  })

  it('resolves power source with AC > USB > Wireless > Dock precedence', () => {
    const usbOnly = parseBatteryDump('USB powered: true\nlevel: 40')
    expect(usbOnly.computed.isCharging).toBe(true)
    expect(usbOnly.computed.powerSource).toBe('USB')

    const none = parseBatteryDump('AC powered: false\nUSB powered: false\nlevel: 10')
    expect(none.computed.isCharging).toBe(false)
    expect(none.computed.powerSource).toBe('Battery')

    const docked = parseBatteryDump('Dock powered: true\nlevel: 70')
    expect(docked.computed.powerSource).toBe('Dock')
  })

  it('yields null metrics when sensors omit values', () => {
    const minimal = parseBatteryDump('level: 50')
    expect(minimal.raw.level).toBe(50)
    expect(minimal.computed.batteryPercentage).toBe(50)
    expect(minimal.computed.temperatureCelsius).toBeNull()
    expect(minimal.computed.voltageV).toBeNull()
    expect(minimal.computed.isCharging).toBe(false)
  })
})
