import { describe, expect, it } from 'vitest'
import {
  buildKeymapCommand,
  createDefaultBinding,
  createDefaultProfile,
  resolveKeyeventCode,
  validateKeymapBinding,
} from '../src/utils/keymap/index.js'

describe('keymap Executor', () => {
  describe('resolveKeyeventCode', () => {
    it('resolves known key names', () => {
      expect(resolveKeyeventCode('HOME')).toBe(3)
      expect(resolveKeyeventCode('BACK')).toBe(4)
      expect(resolveKeyeventCode('VOLUME_UP')).toBe(24)
      expect(resolveKeyeventCode('VOLUME_DOWN')).toBe(25)
      expect(resolveKeyeventCode('POWER')).toBe(26)
      expect(resolveKeyeventCode('ENTER')).toBe(66)
    })

    it('resolves numeric codes', () => {
      expect(resolveKeyeventCode('187')).toBe(187)
      expect(resolveKeyeventCode(187)).toBe(187)
      expect(resolveKeyeventCode(0)).toBe(0)
    })

    it('returns null for invalid codes', () => {
      expect(resolveKeyeventCode('INVALID')).toBeNull()
      expect(resolveKeyeventCode('')).toBeNull()
      expect(resolveKeyeventCode(-1)).toBeNull()
      expect(resolveKeyeventCode(null)).toBeNull()
      expect(resolveKeyeventCode(undefined)).toBeNull()
    })
  })

  describe('validateKeymapBinding', () => {
    it('rejects invalid binding objects', () => {
      expect(validateKeymapBinding(null)).toBeTruthy()
      expect(validateKeymapBinding('string')).toBeTruthy()
      expect(validateKeymapBinding(123)).toBeTruthy()
      expect(validateKeymapBinding({})).toBeTruthy() // missing action
    })

    it('rejects unknown action types', () => {
      expect(validateKeymapBinding({ action: 'unknown' })).toBeTruthy()
      expect(validateKeymapBinding({ action: 'invalid' })).toBeTruthy()
    })

    it('validates keyevent bindings', () => {
      expect(validateKeymapBinding({ action: 'keyevent', params: {} })).toBeTruthy()
      expect(validateKeymapBinding({ action: 'keyevent', params: { code: 'INVALID' } })).toBeTruthy()
      expect(validateKeymapBinding({ action: 'keyevent', params: { code: 'HOME' } })).toBeNull()
      expect(validateKeymapBinding({ action: 'keyevent', params: { code: 187 } })).toBeNull()
    })

    it('validates tap bindings', () => {
      expect(validateKeymapBinding({ action: 'tap', params: {} })).toBeTruthy()
      expect(validateKeymapBinding({ action: 'tap', params: { x: -1, y: 0 } })).toBeTruthy()
      expect(validateKeymapBinding({ action: 'tap', params: { x: 100, y: 200 } })).toBeNull()
    })

    it('validates swipe bindings', () => {
      expect(validateKeymapBinding({ action: 'swipe', params: {} })).toBeTruthy()
      expect(validateKeymapBinding({ action: 'swipe', params: { startX: 0, startY: 0, endX: -1, endY: 0 } })).toBeTruthy()
      expect(validateKeymapBinding({ action: 'swipe', params: { startX: 100, startY: 100, endX: 200, endY: 200 } })).toBeNull()
      expect(validateKeymapBinding({ action: 'swipe', params: { startX: 100, startY: 100, endX: 200, endY: 200, duration: -1 } })).toBeTruthy()
      expect(validateKeymapBinding({ action: 'swipe', params: { startX: 100, startY: 100, endX: 200, endY: 200, duration: 300 } })).toBeNull()
    })

    it('validates text bindings', () => {
      expect(validateKeymapBinding({ action: 'text', params: {} })).toBeTruthy()
      expect(validateKeymapBinding({ action: 'text', params: { text: '' } })).toBeTruthy()
      expect(validateKeymapBinding({ action: 'text', params: { text: 'hello' } })).toBeNull()
    })

    it('validates shell bindings', () => {
      expect(validateKeymapBinding({ action: 'shell', params: {} })).toBeTruthy()
      expect(validateKeymapBinding({ action: 'shell', params: { command: '' } })).toBeTruthy()
      expect(validateKeymapBinding({ action: 'shell', params: { command: 'input keyevent 3' } })).toBeNull()
    })

    it('validates macro bindings', () => {
      expect(validateKeymapBinding({ action: 'macro', params: {} })).toBeTruthy()
      expect(validateKeymapBinding({ action: 'macro', params: { steps: [] } })).toBeTruthy()
      expect(validateKeymapBinding({
        action: 'macro',
        params: { steps: [{ type: 'tap', x: 100, y: 200 }] },
      })).toBeNull()
      expect(validateKeymapBinding({
        action: 'macro',
        params: { steps: [{ type: 'invalid' }] },
      })).toBeTruthy()
    })
  })

  describe('buildKeymapCommand', () => {
    it('builds keyevent commands', () => {
      expect(buildKeymapCommand({ action: 'keyevent', params: { code: 'HOME' } })).toBe('input keyevent 3')
      expect(buildKeymapCommand({ action: 'keyevent', params: { code: 187 } })).toBe('input keyevent 187')
    })

    it('builds tap commands', () => {
      expect(buildKeymapCommand({ action: 'tap', params: { x: 100, y: 200 } })).toBe('input tap 100 200')
    })

    it('builds swipe commands', () => {
      expect(buildKeymapCommand({
        action: 'swipe',
        params: { startX: 100, startY: 100, endX: 200, endY: 200 },
      })).toBe('input swipe 100 100 200 200')
      expect(buildKeymapCommand({
        action: 'swipe',
        params: { startX: 100, startY: 100, endX: 200, endY: 200, duration: 300 },
      })).toBe('input swipe 100 100 200 200 300')
    })

    it('builds text commands', () => {
      expect(buildKeymapCommand({ action: 'text', params: { text: 'hello world' } })).toBe('input text hello%sworld')
    })

    it('builds shell commands', () => {
      expect(buildKeymapCommand({ action: 'shell', params: { command: 'input keyevent 3' } })).toBe('input keyevent 3')
      expect(buildKeymapCommand({ action: 'shell', params: { command: 'shell input keyevent 3' } })).toBe('input keyevent 3')
    })

    it('returns macro marker for macro actions', () => {
      expect(buildKeymapCommand({ action: 'macro', params: { steps: [] } })).toBe('macro')
    })
  })

  describe('createDefaultBinding', () => {
    it('creates default bindings for each action type', () => {
      const keyevent = createDefaultBinding('keyevent')
      expect(keyevent.action).toBe('keyevent')
      expect(keyevent.params).toEqual({ code: '' })
      expect(keyevent.enabled).toBe(true)
      expect(keyevent.id).toMatch(/^binding_\d+_[a-z0-9]+$/)

      const tap = createDefaultBinding('tap')
      expect(tap.params).toEqual({ x: 0, y: 0 })

      const swipe = createDefaultBinding('swipe')
      expect(swipe.params).toEqual({ startX: 0, startY: 0, endX: 0, endY: 0, duration: 300 })

      const text = createDefaultBinding('text')
      expect(text.params).toEqual({ text: '' })

      const shell = createDefaultBinding('shell')
      expect(shell.params).toEqual({ command: '' })

      const macro = createDefaultBinding('macro')
      expect(macro.params).toEqual({ steps: [] })
    })
  })

  describe('createDefaultProfile', () => {
    it('creates a valid profile structure', () => {
      const profile = createDefaultProfile('Test Profile')
      expect(profile.name).toBe('Test Profile')
      expect(profile.bindings).toEqual([])
      expect(profile.id).toMatch(/^profile_\d+_[a-z0-9]+$/)
    })
  })
})
