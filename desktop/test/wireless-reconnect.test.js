import { describe, expect, it, vi } from 'vitest'
import {
  createWirelessReconnectTracker,
  isWirelessAddress,
} from '../src/utils/device/wireless-reconnect/index.js'

describe('isWirelessAddress', () => {
  it.each([
    '192.168.0.7:5555',
    'localhost:5555',
    'myhost.example:5037',
    '[fd7a:115c:a1e0::9c01]:5555',
  ])('accepts connectable address %s', (id) => {
    expect(isWirelessAddress(id)).toBe(true)
  })

  it.each([
    'emulator-5554',
    'R58NA1B2C3',
    '',
    undefined,
    'adb-abc123-def456._adb-tls-connect._tcp.',
    'no-port-at-all:',
  ])('rejects non-connectable id %s', (id) => {
    expect(isWirelessAddress(id)).toBe(false)
  })
})

describe('createWirelessReconnectTracker', () => {
  it('allows attempts until maxFailures is reached', () => {
    const tracker = createWirelessReconnectTracker({ maxFailures: 3 })

    expect(tracker.canAttempt('a')).toBe(true)

    tracker.recordFailure('a')
    tracker.recordFailure('a')
    expect(tracker.canAttempt('a')).toBe(true)

    tracker.recordFailure('a')
    expect(tracker.canAttempt('a')).toBe(false)
  })

  it('tracks failures per device independently', () => {
    const tracker = createWirelessReconnectTracker({ maxFailures: 2 })
    tracker.recordFailure('a')
    tracker.recordFailure('a')

    expect(tracker.canAttempt('a')).toBe(false)
    expect(tracker.canAttempt('b')).toBe(true)
  })

  it('clears the failure counter on success', () => {
    const tracker = createWirelessReconnectTracker({ maxFailures: 1 })

    tracker.recordFailure('a')
    expect(tracker.canAttempt('a')).toBe(false)

    tracker.recordSuccess('a')
    expect(tracker.canAttempt('a')).toBe(true)
  })

  it('persists counters through load/save hooks', () => {
    const save = vi.fn()
    const persisted = { stale: 3 }
    const load = vi.fn(() => persisted)

    const tracker = createWirelessReconnectTracker({
      maxFailures: 3,
      load,
      save,
    })

    expect(tracker.canAttempt('stale')).toBe(false)
    expect(load).toHaveBeenCalled()

    tracker.recordFailure('fresh')
    expect(save).toHaveBeenCalledWith({ stale: 3, fresh: 1 })
  })

  it('restores a clean slate via reset', () => {
    let saved = {}
    const tracker = createWirelessReconnectTracker({
      maxFailures: 1,
      load: () => saved,
      save: value => (saved = value),
    })

    tracker.recordFailure('a')
    expect(tracker.canAttempt('a')).toBe(false)

    tracker.reset()
    expect(tracker.canAttempt('a')).toBe(true)
  })

  it('disables attempts when maxFailures is not positive and allows unlimited via null', () => {
    for (const maxFailures of [0, -1]) {
      const tracker = createWirelessReconnectTracker({ maxFailures })
      expect(tracker.canAttempt('any')).toBe(false)
    }

    const unlimited = createWirelessReconnectTracker({ maxFailures: null })
    for (let i = 0; i < 10; i++) {
      unlimited.recordFailure('any')
    }
    expect(unlimited.canAttempt('any')).toBe(true)
  })
})
