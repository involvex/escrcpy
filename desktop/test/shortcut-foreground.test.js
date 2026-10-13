import { describe, expect, it } from 'vitest'
import {
  classifyForegroundWindow,
  extractSerialFromTitle,
  isMirrorWindow,
  selectBindingDir,
} from '../electron/services/shortcuts/foreground.js'

describe('foreground mirror detection', () => {
  describe('extractSerialFromTitle', () => {
    it('extracts the serial from mirror titles', () => {
      expect(extractSerialFromTitle('Pixel[ABC123]-Mirror-Escrcpy')).toBe('ABC123')
    })

    it('returns null for missing or serial-less titles', () => {
      expect(extractSerialFromTitle(null)).toBeNull()
      expect(extractSerialFromTitle('Edge')).toBeNull()
    })
  })

  describe('isMirrorWindow', () => {
    it('matches the scrcpy owner process regardless of title', () => {
      expect(isMirrorWindow({ title: 'Custom Title', owner: { name: 'scrcpy.exe', path: 'C:\\tools\\scrcpy.exe' } })).toBe(true)
      expect(isMirrorWindow({ title: 'whatever', owner: { name: 'scrcpy', path: '/usr/bin/scrcpy' } })).toBe(true)
    })

    it('matches Escrcpy mirror titles from other owners', () => {
      expect(isMirrorWindow({ title: 'Pixel[ABC123]-Mirror-Escrcpy', owner: { name: 'unknown' } })).toBe(true)
    })

    it('rejects browsers and empty input', () => {
      expect(isMirrorWindow({ title: 'Edge', owner: { name: 'msedge.exe' } })).toBe(false)
      expect(isMirrorWindow(null)).toBe(false)
      expect(isMirrorWindow(undefined)).toBe(false)
    })
  })

  describe('classifyForegroundWindow', () => {
    it('resolves the foreground serial when it is still mirrored', () => {
      expect(classifyForegroundWindow(
        { title: 'Pixel[dev2]-Mirror-Escrcpy', owner: { name: 'scrcpy.exe' } },
        ['dev1', 'dev2'],
      )).toEqual({ isMirrorForeground: true, foregroundSerial: 'dev2' })
    })

    it('stays mirror-foreground without a resolvable serial (custom title)', () => {
      expect(classifyForegroundWindow(
        { title: 'My Game', owner: { name: 'scrcpy.exe' } },
        ['dev1'],
      )).toEqual({ isMirrorForeground: true, foregroundSerial: null })
    })

    it('is not mirror-foreground without active mirrors or for other apps', () => {
      expect(classifyForegroundWindow(
        { title: 'Pixel[dev1]-Mirror-Escrcpy', owner: { name: 'scrcpy.exe' } },
        [],
      )).toEqual({ isMirrorForeground: false, foregroundSerial: null })
      expect(classifyForegroundWindow(
        { title: 'Edge', owner: { name: 'msedge.exe' } },
        ['dev1'],
      )).toEqual({ isMirrorForeground: false, foregroundSerial: null })
    })
  })

  describe('selectBindingDir', () => {
    it('prefers the exact platform/arch build', () => {
      expect(selectBindingDir(
        ['napi-9-darwin-unknown-arm64', 'napi-9-win32-unknown-x64'],
        { platform: 'win32', arch: 'x64' },
      )).toBe('napi-9-win32-unknown-x64')
    })

    it('falls back to any napi build and null when empty', () => {
      expect(selectBindingDir(['napi-9-darwin-unknown-arm64'], { platform: 'win32', arch: 'x64' }))
        .toBe('napi-9-darwin-unknown-arm64')
      expect(selectBindingDir([])).toBeNull()
      expect(selectBindingDir(null)).toBeNull()
    })
  })
})
