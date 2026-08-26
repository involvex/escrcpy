import { describe, expect, it } from 'vitest'
import {
  parsePreferenceImport,
  PREFERENCE_TRANSFER_KEYS,
} from '../src/utils/preference-transfer/index.js'

const VALID_PREFERENCES = {
  common: { language: 'en-US', concurrencyLimit: 8 },
  scrcpy: {
    'global': { '--max-fps': 60 },
    'emulator-5554': { '--max-size': 1280 },
  },
  copilot: { model: 'autoglm-phone', maxSteps: 20 },
}

describe('preference transfer keys', () => {
  it('covers the persisted top-level preference keys', () => {
    for (const key of [
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
    ]) {
      expect(PREFERENCE_TRANSFER_KEYS).toContain(key)
    }
  })
})

describe('parsePreferenceImport', () => {
  it('accepts a raw electron-store dump keeping only known keys', () => {
    const parsed = parsePreferenceImport(JSON.stringify({
      ...VALID_PREFERENCES,
      lastConnectedDevice: { id: 'x', timestamp: 1 },
      someJunkKey: { a: 1 },
    }))

    expect(parsed.ok).toBe(true)
    expect(parsed.preferences).toEqual(VALID_PREFERENCES)
  })

  it('accepts an already-parsed object', () => {
    expect(parsePreferenceImport(VALID_PREFERENCES)).toEqual({
      ok: true,
      preferences: VALID_PREFERENCES,
    })
  })

  it('supports the wrapped transfer envelope', () => {
    const wrapped = {
      app: 'escrcpy',
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      preferences: VALID_PREFERENCES,
    }

    expect(parsePreferenceImport(wrapped)).toEqual({
      ok: true,
      preferences: VALID_PREFERENCES,
    })
  })

  it('rejects invalid JSON strings', () => {
    const parsed = parsePreferenceImport('{not json')
    expect(parsed.ok).toBe(false)
    expect(parsed.error).toMatch(/json/i)
  })

  it.each([null, undefined, 42, 'plain text', [], ['nope']])(
    'rejects non-object payloads %j',
    (payload) => {
      expect(parsePreferenceImport(payload).ok).toBe(false)
    },
  )

  it('drops non-object values for known keys', () => {
    const parsed = parsePreferenceImport({
      common: { language: 'zh-CN' },
      copilot: 'not-an-object',
      video: 123,
      scrcpy: null,
    })

    expect(parsed.ok).toBe(true)
    expect(parsed.preferences).toEqual({ common: { language: 'zh-CN' } })
  })

  it('fails when nothing usable survives filtering', () => {
    const parsed = parsePreferenceImport({ junk: {}, lastConnectedDevice: {} })
    expect(parsed.ok).toBe(false)
    expect(parsed.error).toMatch(/no valid/i)
  })
})
