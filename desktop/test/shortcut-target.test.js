import { describe, expect, it } from 'vitest'
import {
  selectTargetSerial,
  shouldActivateShortcuts,
  toSerialList,
} from '../electron/services/shortcuts/target.js'

describe('shortcut target selection', () => {
  describe('toSerialList', () => {
    it('normalizes and dedupes while preserving order', () => {
      expect(toSerialList(['a', 123, null, undefined, '', 'a'])).toEqual(['a', '123'])
    })

    it('handles missing input', () => {
      expect(toSerialList()).toEqual([])
      expect(toSerialList(null)).toEqual([])
    })
  })

  describe('selectTargetSerial', () => {
    it('returns null when nothing is mirrored', () => {
      expect(selectTargetSerial({ focusedDeviceSerial: 'abc', activeSerials: [] })).toBeNull()
      expect(selectTargetSerial({})).toBeNull()
    })

    it('prefers the focused device while it is still mirrored', () => {
      expect(selectTargetSerial({
        focusedDeviceSerial: 'dev2',
        activeSerials: ['dev1', 'dev2'],
        fallbackSerial: 'dev1',
      })).toBe('dev2')
    })

    it('falls back to the most recently started active mirror', () => {
      // Stale focus (device no longer mirrored) must not kill hotkeys.
      expect(selectTargetSerial({
        focusedDeviceSerial: 'gone',
        activeSerials: ['dev1'],
        fallbackSerial: 'dev1',
      })).toBe('dev1')
    })

    it('falls back to the newest active mirror without any focus info', () => {
      // Regression: focus events can be missed (e.g. control window never
      // reports focus) — a running mirror while the app is focused must
      // still receive hotkeys instead of staying dead.
      expect(selectTargetSerial({
        focusedDeviceSerial: null,
        activeSerials: ['dev1', 'dev2'],
        fallbackSerial: null,
      })).toBe('dev2')
    })

    it('ignores fallback serials that are no longer active', () => {
      expect(selectTargetSerial({
        activeSerials: ['dev1'],
        fallbackSerial: 'gone',
      })).toBe('dev1')
    })
  })

  describe('shouldActivateShortcuts', () => {
    it('never activates without an active mirror and target', () => {
      expect(shouldActivateShortcuts({ activeCount: 0, targetSerial: 'dev1', isAppFocused: true })).toBe(false)
      expect(shouldActivateShortcuts({ activeCount: 1, targetSerial: null, isAppFocused: true })).toBe(false)
    })

    it('requires app focus in gated (default) mode', () => {
      expect(shouldActivateShortcuts({ activeCount: 1, targetSerial: 'dev1', isAppFocused: true })).toBe(true)
      expect(shouldActivateShortcuts({ activeCount: 1, targetSerial: 'dev1', isAppFocused: false })).toBe(false)
    })

    it('allows unfocused operation in global opt-in mode', () => {
      expect(shouldActivateShortcuts({ activeCount: 1, targetSerial: 'dev1', isAppFocused: false, globalEnabled: true })).toBe(true)
    })
  })
})
