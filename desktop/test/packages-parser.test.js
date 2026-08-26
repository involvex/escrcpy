import { describe, expect, it } from 'vitest'
import {
  parseDumpsysBlock,
  parseDumpsysPackages,
  parseLsOutput,
  parsePackageList,
  parsePackageNames,
} from '../electron/middleware/adb/helpers/packages/index.js'

describe('parsePackageList', () => {
  it('extracts name and apk path from `pm list packages -f` output', () => {
    const output = [
      'package:/data/app/~~aBc==/com.example.app-123==/base.apk=com.example.app',
      'package:/system/app/Settings/Settings.apk=com.android.settings',
      'not-a-package-line',
      '',
    ].join('\n')

    expect(parsePackageList(output)).toEqual([
      { name: 'com.example.app', apkPath: '/data/app/~~aBc==/com.example.app-123==/base.apk' },
      { name: 'com.android.settings', apkPath: '/system/app/Settings/Settings.apk' },
    ])
  })

  it('skips malformed entries without a separator or name', () => {
    const output = ['package:=novalue', 'package:', 'package:nopath'].join('\n')
    expect(parsePackageList(output)).toEqual([])
  })

  it('tolerates CRLF and null input', () => {
    expect(parsePackageList('package:/a=b\r\n')).toEqual([{ name: 'b', apkPath: '/a' }])
    expect(parsePackageList(null)).toEqual([])
  })
})

describe('parsePackageNames', () => {
  it('returns bare package names only', () => {
    expect(parsePackageNames('package:com.a\njunk\npackage:com.b\n'))
      .toEqual(['com.a', 'com.b'])
  })

  it('returns empty array for null input', () => {
    expect(parsePackageNames(undefined)).toEqual([])
  })
})

describe('parseLsOutput', () => {
  const output = [
    'total 24',
    '-rw-r--r-- 1 root root 12345 2024-01-05 10:00 base.apk',
    '-rw-r--r-- 1 root root 6789 2024-01-05 10:01 split_config.arm64_v8a.apk',
    'drwxr-xr-x 2 root root 4096 2024-01-05 10:02 subdir',
    '-rw-r--r-- 1 root root 42 2024-01-05 10:03 .hidden.apk',
    'lrwxrwxrwx 1 root root 13 2024-01-05 10:04 link -> target',
  ].join('\n')

  it('collects regular files with sizes and skips dirs and links', () => {
    expect(parseLsOutput(output)).toEqual([
      { name: 'base.apk', size: 12345 },
      { name: 'split_config.arm64_v8a.apk', size: 6789 },
      { name: '.hidden.apk', size: 42 },
    ])
  })

  it('returns empty array for null input', () => {
    expect(parseLsOutput(null)).toEqual([])
  })
})

const DUMPSYS_OUTPUT = `Packages:
Package [com.example.app] (1234):
  userId=10100
  versionName=2.11.1
  versionCode=21101
  firstInstallTime=2024-01-05 10:00:00
  lastUpdateTime=2024-08-20 12:30:45
  installerPackageName=com.android.packageinstaller
  requested permissions:
    android.permission.INTERNET
    android.permission.CAMERA
  install permissions:
  User 0: ceDataInode=12345

Hidden system packages:
Package [com.example.app] (9999):
  versionName=0.0.1
  versionCode=1

Package [com.other.app] (2345):
  versionName=1.0.0
  versionCode=100 targetSdk=29
`

describe('parseDumpsysBlock', () => {
  it('extracts version, install times, installer, and permissions', () => {
    const lines = [
      'userId=10100',
      'versionName=2.11.1',
      'versionCode=21101 minSdk=21 targetSdk=34',
      'firstInstallTime=2024-01-05 10:00:00',
      'lastUpdateTime=2024-08-20 12:30:45',
      'installerPackageName=com.android.packageinstaller',
      'requested permissions:',
      'android.permission.INTERNET',
      'android.permission.CAMERA',
      'install permissions:',
    ]

    expect(parseDumpsysBlock(lines)).toEqual({
      versionName: '2.11.1',
      versionCode: '21101',
      firstInstallTime: '2024-01-05 10:00:00',
      lastUpdateTime: '2024-08-20 12:30:45',
      installerPackageName: 'com.android.packageinstaller',
      permissions: [
        'android.permission.INTERNET',
        'android.permission.CAMERA',
      ],
    })
  })

  it('returns an empty skeleton for blank input', () => {
    expect(parseDumpsysBlock([])).toEqual({
      versionName: '',
      versionCode: '',
      firstInstallTime: '',
      lastUpdateTime: '',
      installerPackageName: '',
      permissions: [],
    })
  })
})

describe('parseDumpsysPackages', () => {
  it('maps every package header to its parsed info', () => {
    const result = parseDumpsysPackages(DUMPSYS_OUTPUT)
    expect(Object.keys(result).sort()).toEqual(['com.example.app', 'com.other.app'])

    expect(result['com.example.app'].versionName).toBe('2.11.1')
    expect(result['com.example.app'].versionCode).toBe('21101')
    expect(result['com.other.app'].versionCode).toBe('100')
  })

  it('keeps the first occurrence when a package appears twice', () => {
    const result = parseDumpsysPackages(DUMPSYS_OUTPUT)
    expect(result['com.example.app'].versionName).not.toBe('0.0.1')
  })

  it('returns empty object for null input', () => {
    expect(parseDumpsysPackages(null)).toEqual({})
  })
})
