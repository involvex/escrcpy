import { describe, expect, it } from 'vitest'
import {
  assertSafePackageName,
  assertSafeSerial,
  assertSafeShellArgument,
  isSafeShellArgument,
  sanitizeDisplayText,
  sanitizeFilePath,
} from '../electron/helpers/shell/safe-args.js'

describe('isSafeShellArgument', () => {
  it('accepts plain identifiers and network addresses', () => {
    expect(isSafeShellArgument('emulator-5554')).toBe(true)
    expect(isSafeShellArgument('192.168.1.7:5555')).toBe(true)
    expect(isSafeShellArgument('com.android.adbkeyboard')).toBe(true)
  })

  it.each(['"', '\'', '\\', ';', '$', '&', '|', '<', '>', '(', ')', '`'])(
    'rejects arguments containing %s',
    (char) => {
      expect(isSafeShellArgument(`safe${char}value`)).toBe(false)
    },
  )

  it('coerces non-strings and allows empty values', () => {
    expect(isSafeShellArgument('')).toBe(true)
    expect(isSafeShellArgument(123)).toBe(true)
    expect(isSafeShellArgument(undefined)).toBe(true)
  })
})

describe('assertSafeShellArgument', () => {
  it('returns the value when safe', () => {
    expect(assertSafeShellArgument('5555', 'port')).toBe('5555')
  })

  it('throws a labeled error when unsafe', () => {
    expect(() => assertSafeShellArgument('1; rm -rf /', 'port'))
      .toThrowError(/port/)
  })
})

describe('assertSafeSerial', () => {
  it.each([
    'emulator-5554',
    '192.168.1.7:5555',
    'localhost:7555',
    'R58NA1B2C3',
  ])('accepts adb-style serial %s', (serial) => {
    expect(assertSafeSerial(serial)).toBe(serial)
  })

  it.each([
    'with space',
    'quote"injection',
    'semi;colon',
    'pipe|x',
    '',
    undefined,
  ])('rejects serial %s', (serial) => {
    expect(() => assertSafeSerial(serial)).toThrowError(/serial/i)
  })
})

describe('sanitizeDisplayText', () => {
  it('strips shell metacharacters while keeping readable text', () => {
    expect(sanitizeDisplayText('My "Pixel" & Tab')).toBe('My Pixel Tab')
    expect(sanitizeDisplayText('device$(calc)name')).toBe('devicecalcname')
    expect(sanitizeDisplayText('multi\nline\ttitle')).toBe('multi line title')
  })

  it('preserves unicode device names', () => {
    expect(sanitizeDisplayText('我的手机"测试"')).toBe('我的手机测试')
  })

  it('falls back to escrcpy when nothing remains', () => {
    expect(sanitizeDisplayText('"&|;')).toBe('escrcpy')
    expect(sanitizeDisplayText(undefined)).toBe('escrcpy')
  })
})

describe('sanitizeFilePath', () => {
  it('keeps windows separators, drive letters, and spaces', () => {
    expect(sanitizeFilePath('C:\\Users\\te st\\recording.mp4'))
      .toBe('C:\\Users\\te st\\recording.mp4')
  })

  it('strips metacharacters from hostile paths', () => {
    expect(sanitizeFilePath('D:\\vid"&calc\\.mp4')).toBe('D:\\vidcalc\\.mp4')
    expect(sanitizeFilePath('/sdcard/a;b$c.mp4')).toBe('/sdcard/abc.mp4')
  })
})

describe('assertSafePackageName', () => {
  it('accepts valid android package names', () => {
    expect(assertSafePackageName('com.example.app')).toBe('com.example.app')
    expect(assertSafePackageName('COM.EXAMPLE.APP')).toBe('COM.EXAMPLE.APP')
  })

  it.each([
    'nodots',
    'com.sp ace',
    'com.p;rm',
    '.leading.dot',
    '',
  ])('rejects package name %s', (pkg) => {
    expect(() => assertSafePackageName(pkg)).toThrowError(/package/i)
  })
})
