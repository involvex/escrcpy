import { delimiter, dirname, join } from 'node:path'
import fs from 'node:fs'
import { extraResolve } from './resources.js'
import { getAdbPath, getGnirehtetPath, getScrcpyPath, gnirehtetApkPath } from '$electron/configs/index.js'

// Raw PATH environment variable (captured once before any injection)
export const rawEnvPath = process.env.PATH || ''

/**
 * Resolve a new PATH environment string by injecting platform-specific or auto-detected paths.
 * @param {Object} [options] - Custom path configurations per platform
 * @param {string[]} [options.win] - Paths to inject on Windows
 * @param {string[]} [options.mac] - Paths to inject on macOS
 * @param {string[]} [options.linux] - Paths to inject on Linux
 * @param {string[]} [options.auto] - Paths to inject automatically based on the current platform
 * @param {string[]} [options.prepend] - Paths that must come before the system PATH (chosen tools)
 * @param {string[]} [options.append] - Paths appended after the system PATH (bundled fallbacks)
 * @returns {string} The resulting PATH string after injection
 */
export function resolveEnvPath(options = {}) {
  const PLATFORM_MAP = Object.freeze({
    win32: 'win',
    darwin: 'mac',
    linux: 'linux',
  })

  const currentPlatform = PLATFORM_MAP[process.platform]
  const seen = new Set()

  function collect(keys) {
    return keys.reduce((arr, key) => {
      for (const item of options[key] || []) {
        if (!item || seen.has(item) || rawEnvPath.includes(item)) {
          continue
        }
        seen.add(item)
        arr.push(item)
      }
      return arr
    }, [])
  }

  const prependPaths = collect(['prepend', 'auto', currentPlatform].filter(Boolean))
  const appendPaths = collect(['append'])

  const parts = [...prependPaths, rawEnvPath, ...appendPaths].filter(Boolean)
  return parts.join(delimiter)
}

/**
 * Setup the PATH environment variable by injecting necessary tool paths.
 * System PATH adb wins: chosen adb/scrcpy/gnirehtet dirs are prepended;
 * bundled platform dirs that may ship a competing adb are appended.
 */
export function setupEnvPath() {
  // Resolve preferred binaries against raw/store paths before mutating PATH
  const adbPath = getAdbPath()
  const scrcpyPath = getScrcpyPath()
  const gnirehtetPath = getGnirehtetPath()

  const adbDir = adbPath ? dirname(adbPath) : void 0
  const scrcpyDir = scrcpyPath ? dirname(scrcpyPath) : void 0
  const gnirehtetDir = gnirehtetPath ? dirname(gnirehtetPath) : void 0

  // Same-dir bundled adb+scrcpy (win/scrcpy) is fine; only skip foreign dirs that ship a different adb
  let pathScrcpyDir = scrcpyDir
  if (scrcpyDir && adbDir && scrcpyDir !== adbDir) {
    const competingAdb = join(scrcpyDir, process.platform === 'win32' ? 'adb.exe' : 'adb')
    if (fs.existsSync(competingAdb)) {
      try {
        const same = adbPath && fs.realpathSync(competingAdb) === fs.realpathSync(adbPath)
        if (!same) {
          pathScrcpyDir = void 0
        }
      }
      catch {
        pathScrcpyDir = void 0
      }
    }
  }

  // Bundled dirs as fallbacks after the pinned dirs
  const bundledFallback = {
    win: [
      extraResolve('win/scrcpy'),
      extraResolve(`win-${process.arch}`),
      extraResolve('win'),
      extraResolve('win/gnirehtet'),
    ],
    mac: [
      extraResolve(`mac-${process.arch}/scrcpy`),
      extraResolve(`mac-${process.arch}`),
      extraResolve(`mac-${process.arch}/gnirehtet`),
    ],
    linux: [
      extraResolve(`linux-${process.arch}/scrcpy`),
      extraResolve(`linux-${process.arch}`),
      extraResolve(`linux-${process.arch}/gnirehtet`),
    ],
  }

  const PLATFORM_MAP = Object.freeze({
    win32: 'win',
    darwin: 'mac',
    linux: 'linux',
  })
  const platformKey = PLATFORM_MAP[process.platform]

  process.env.PATH = resolveEnvPath({
    prepend: [
      adbDir,
      pathScrcpyDir,
      gnirehtetDir,
    ],
    append: platformKey ? bundledFallback[platformKey] : [],
  })

  // Pin ADB for scrcpy/subprocess use to the already-resolved path (never re-which after injection)
  process.env.ADB = adbPath || ''

  // Ensure GNIREHTET_APK path is set in environment for subprocesses
  process.env.GNIREHTET_APK = gnirehtetApkPath

  // Pair scrcpy-server with the resolved client.
  // PATH/scoop installs often live behind a shim without a sibling server — resolve the real binary dir when possible.
  // Bundled installs ship the server under extra/common/scrcpy.
  const commonScrcpyDir = extraResolve('common/scrcpy')
  const bundledServer = join(commonScrcpyDir, 'scrcpy-server')
  const usingBundledClient = Boolean(scrcpyDir && scrcpyDir.replace(/\\/g, '/').includes('/extra/'))

  let clientDir = scrcpyDir
  if (scrcpyPath) {
    try {
      clientDir = dirname(fs.realpathSync(scrcpyPath))
    }
    catch {
      clientDir = scrcpyDir
    }
  }

  const besideServer = clientDir ? join(clientDir, 'scrcpy-server') : ''

  // Scoop shims: resolve apps/scrcpy/current/scrcpy-server when the shim has no sibling
  let scoopServer = ''
  if (clientDir && /[/\\]scoop[/\\]shims$/i.test(clientDir.replace(/\\/g, '/'))) {
    const scoopCurrent = join(clientDir, '..', 'apps', 'scrcpy', 'current', 'scrcpy-server')
    if (fs.existsSync(scoopCurrent)) {
      scoopServer = scoopCurrent
    }
  }

  process.env.SCRCPY_ICON_DIR = commonScrcpyDir

  if (besideServer && fs.existsSync(besideServer)) {
    process.env.SCRCPY_SERVER_PATH = besideServer
  }
  else if (scoopServer) {
    process.env.SCRCPY_SERVER_PATH = scoopServer
  }
  else if (usingBundledClient && fs.existsSync(bundledServer)) {
    process.env.SCRCPY_SERVER_PATH = bundledServer
  }
  else {
    delete process.env.SCRCPY_SERVER_PATH
  }
}
