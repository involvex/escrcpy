import { describe, expect, it } from 'vitest'
import {
  buildAdbArgs,
  buildScrcpyArgs,
  buildScrcpyRecordArgs,
  parseAdbDevices,
  parseCliArgs,
} from '../src/utils/cli/index.js'

describe('parseCliArgs', () => {
  it('parses the devices command with optional json flag', () => {
    expect(parseCliArgs(['devices'])).toMatchObject({ command: 'devices', json: false })
    expect(parseCliArgs(['devices', '--json'])).toMatchObject({ command: 'devices', json: true })
  })

  it('parses mirror with passthrough scrcpy args and binary overrides', () => {
    const parsed = parseCliArgs([
      '--scrcpy', 'D:\\tools\\scrcpy.exe',
      'mirror', 'emulator-5554', '--max-size', '1280', '--no-audio',
    ])

    expect(parsed).toMatchObject({
      command: 'mirror',
      serial: 'emulator-5554',
      scrcpyPath: 'D:\\tools\\scrcpy.exe',
      scrcpyArgs: ['--max-size', '1280', '--no-audio'],
    })
  })

  it('parses shot with an output path', () => {
    expect(parseCliArgs(['shot', 'abc123', '-o', 'cap.png'])).toMatchObject({
      command: 'shot',
      serial: 'abc123',
      out: 'cap.png',
    })
  })

  it('parses install with serial and apk', () => {
    expect(parseCliArgs(['install', 'abc123', 'app.apk'])).toMatchObject({
      command: 'install',
      serial: 'abc123',
      apk: 'app.apk',
    })
  })

  it('maps help and version flags regardless of position', () => {
    expect(parseCliArgs(['--help']).command).toBe('help')
    expect(parseCliArgs([]).command).toBe('help')
    expect(parseCliArgs(['devices', '-v']).command).toBe('version')
  })

  it.each([
    [['teleport'], /unknown command/i],
    [['mirror'], /serial required/i],
    [['shot'], /serial required/i],
    [['install', 'abc'], /apk path required/i],
    [['record', 's1'], /output file required/i],
    [['shell', 's1'], /command required/i],
    [['push', 's1'], /local path required/i],
    [['pull', 's1'], /remote path required/i],
    [['connect'], /host.*required/i],
    [['--timeout', 'oops', 'devices'], /timeout/i],
  ])('rejects invalid input %j', (argv, errorPattern) => {
    expect(parseCliArgs(argv).error).toMatch(errorPattern)
  })

  it('parses record/shell/push/pull/connect/battery/logcat', () => {
    expect(parseCliArgs(['record', 's1', '-o', 'out.mp4', '--no-audio'])).toMatchObject({
      command: 'record',
      serial: 's1',
      out: 'out.mp4',
      scrcpyArgs: ['--no-audio'],
    })
    expect(parseCliArgs(['shell', 's1', '--', 'getprop', 'ro.build.version.sdk'])).toMatchObject({
      command: 'shell',
      serial: 's1',
      shellCmd: ['getprop', 'ro.build.version.sdk'],
    })
    expect(parseCliArgs(['push', 's1', 'a.apk'])).toMatchObject({
      command: 'push',
      local: 'a.apk',
      remote: '/sdcard/Download/',
    })
    expect(parseCliArgs(['pull', 's1', '/sdcard/a.txt', 'out.txt'])).toMatchObject({
      command: 'pull',
      remote: '/sdcard/a.txt',
      local: 'out.txt',
    })
    expect(parseCliArgs(['connect', '192.168.1.10:5555'])).toMatchObject({
      command: 'connect',
      host: '192.168.1.10:5555',
    })
    expect(parseCliArgs(['battery', 's1', '--json'])).toMatchObject({
      command: 'battery',
      serial: 's1',
      json: true,
    })
    expect(parseCliArgs(['logcat', 's1', '--dump', '-o', 'log.txt'])).toMatchObject({
      command: 'logcat',
      serial: 's1',
      dump: true,
      out: 'log.txt',
    })
    expect(parseCliArgs(['--timeout', '5000', '--wait-for-device', 'shell', 's1', 'uptime'])).toMatchObject({
      command: 'shell',
      timeoutMs: 5000,
      waitForDevice: true,
    })
  })
})

describe('parseAdbDevices', () => {
  const output = [
    'List of devices attached',
    'emulator-5554\tdevice product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64xa',
    'R58NA1B2C3\tdevice usb:1-1 product:r5 model:SM-S918B',
    '192.168.1.7:5555\toffline',
    '',
    'junk line without tabs',
  ].join('\n')

  it('extracts id, state, and key:value details', () => {
    const devices = parseAdbDevices(output)

    expect(devices).toEqual([
      {
        id: 'emulator-5554',
        state: 'device',
        details: { product: 'sdk_gphone64_x86_64', model: 'sdk_gphone64_x86_64', device: 'emu64xa' },
      },
      {
        id: 'R58NA1B2C3',
        state: 'device',
        details: { usb: '1-1', product: 'r5', model: 'SM-S918B' },
      },
      { id: '192.168.1.7:5555', state: 'offline', details: {} },
    ])
  })

  it('parses space-separated lines emitted for mdns tls devices', () => {
    const output = 'List of devices attached\n'
      + 'adb-HULFY5WW8H5H5DOF-ibBWk9._adb-tls-connect._tcp device product:dash_global model:2602BPC18G\n'

    expect(parseAdbDevices(output)).toEqual([
      {
        id: 'adb-HULFY5WW8H5H5DOF-ibBWk9._adb-tls-connect._tcp',
        state: 'device',
        details: { product: 'dash_global', model: '2602BPC18G' },
      },
    ])
  })

  it('returns empty array for empty or header-only output', () => {
    expect(parseAdbDevices('')).toEqual([])
    expect(parseAdbDevices('List of devices attached\n')).toEqual([])
  })
})

describe('buildAdbArgs / buildScrcpyArgs', () => {
  it('builds device-scoped adb argument lists', () => {
    expect(buildAdbArgs('devices')).toEqual(['devices', '-l'])
    expect(buildAdbArgs('shot', 's1')).toEqual(['-s', 's1', 'exec-out', 'screencap', '-p'])
    expect(buildAdbArgs('install', 's1', 'a.apk')).toEqual(['-s', 's1', 'install', '-r', 'a.apk'])
  })

  it('builds scrcpy args with the serial first', () => {
    expect(buildScrcpyArgs('s1')).toEqual(['-s', 's1'])
    expect(buildScrcpyArgs('s1', ['--no-audio'])).toEqual(['-s', 's1', '--no-audio'])
    expect(buildScrcpyRecordArgs('s1', 'out.mp4', ['--no-audio'])).toEqual(['-s', 's1', '--record=out.mp4', '--no-audio'])
  })

  it('builds adb args for shell/push/pull/connect/battery/logcat', () => {
    expect(buildAdbArgs('shell', 's1', undefined, { shellCmd: ['getprop'] })).toEqual(['-s', 's1', 'shell', 'getprop'])
    expect(buildAdbArgs('push', 's1', undefined, { local: 'a', remote: 'r' })).toEqual(['-s', 's1', 'push', 'a', 'r'])
    expect(buildAdbArgs('pull', 's1', undefined, { remote: 'r', local: 'l' })).toEqual(['-s', 's1', 'pull', 'r', 'l'])
    expect(buildAdbArgs('connect', 'h:5555')).toEqual(['connect', 'h:5555'])
    expect(buildAdbArgs('battery', 's1')).toEqual(['-s', 's1', 'shell', 'dumpsys', 'battery'])
    expect(buildAdbArgs('logcat', 's1', undefined, { dump: true })).toEqual(['-s', 's1', 'logcat', '-d'])
  })
})
