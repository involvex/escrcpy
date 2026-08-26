import { describe, expect, it } from 'vitest'
import { assertSafeScrcpyArgs, assertSafeSerial, assertSafePackageName } from '../electron/helpers/shell/safe-args.js'

describe('assertSafeScrcpyArgs', () => {
  it('accepts valid flag patterns', () => {
    expect(assertSafeScrcpyArgs('--max-size=1024')).toBe('--max-size=1024')
    expect(assertSafeScrcpyArgs('--max-fps 60')).toBe('--max-fps 60')
    expect(assertSafeScrcpyArgs('-b 8M')).toBe('-b 8M')
    expect(assertSafeScrcpyArgs('--video-codec=h264')).toBe('--video-codec=h264')
    expect(assertSafeScrcpyArgs('--window-x=100 --window-y=200')).toBe('--window-x=100 --window-y=200')
    expect(assertSafeScrcpyArgs('')).toBe('')
  })

  it('rejects shell metacharacters that enable command injection', () => {
    expect(() => assertSafeScrcpyArgs('--max-size=1024; rm -rf /')).toThrow(/Unsafe scrcpy arguments/)
    expect(() => assertSafeScrcpyArgs('$(whoami)')).toThrow(/Unsafe scrcpy arguments/)
    expect(() => assertSafeScrcpyArgs('`id`')).toThrow(/Unsafe scrcpy arguments/)
    expect(() => assertSafeScrcpyArgs('--title="x" & calc')).toThrow(/Unsafe scrcpy arguments/)
    expect(() => assertSafeScrcpyArgs('\|cat /etc/passwd')).toThrow(/Unsafe scrcpy arguments/)
    expect(() => assertSafeScrcpyArgs('--flag$value')).toThrow(/Unsafe scrcpy arguments/)
  })
})

describe('assertSafeSerial', () => {
  it('accepts valid serials', () => {
    expect(assertSafeSerial('emulator-5554')).toBe('emulator-5554')
    expect(assertSafeSerial('192.168.1.1:5555')).toBe('192.168.1.1:5555')
    expect(assertSafeSerial('ABCD1234')).toBe('ABCD1234')
  })

  it('rejects unsafe serials', () => {
    expect(() => assertSafeSerial('; rm -rf /')).toThrow(/Unsafe device serial/)
    expect(() => assertSafeSerial('$(id)')).toThrow(/Unsafe device serial/)
    expect(() => assertSafeSerial(null)).toThrow(/Unsafe device serial/)
  })
})

describe('assertSafePackageName', () => {
  it('accepts valid package names', () => {
    expect(assertSafePackageName('com.example.app')).toBe('com.example.app')
    expect(assertSafePackageName('org.example_test')).toBe('org.example_test')
  })

  it('rejects unsafe package names', () => {
    expect(() => assertSafePackageName('; rm -rf /')).toThrow(/Unsafe package name/)
    expect(() => assertSafePackageName('com.example.$')).not.toThrow()
    expect(() => assertSafePackageName('no-dots')).toThrow(/Unsafe package name/)
  })
})
