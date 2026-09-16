import fs from 'node:fs'
import { join } from 'node:path'
import { extraResolve, whichResolve } from '$electron/process/resources.js'
import electronStore from '$electron/helpers/store/index.js'

/** Original process PATH environment variable (captured once before any injection). */
const systemPathEnv = process.env.PATH || ''

/** Cached ADB path resolved against the original system PATH (before bundled injection). */
let cachedSystemAdbPath

const adbBinary = process.platform === 'win32' ? 'adb.exe' : 'adb'
const scrcpyBinary = process.platform === 'win32' ? 'scrcpy.exe' : 'scrcpy'

/**
 * Validate that a stored path still exists.
 * If not, clear it from the store so future reads fall back to defaults.
 * @returns {string|null} the valid stored path, or null if missing
 */
function resolveStoredPath(store, key) {
  const stored = store.get(key)

  if (!stored) {
    return null
  }

  if (!fs.existsSync(stored)) {
    // Stale path - clear it so we fall back to default
    store.delete(key)
    return null
  }

  return stored
}

function isBundledPath(filePath) {
  if (!filePath) {
    return false
  }
  return filePath.replace(/\\/g, '/').includes('/extra/')
}

function firstExisting(candidates = []) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

/**
 * Bundled platform tool directories shipped under electron/resources/extra.
 */
function getBundledPlatformDirs() {
  switch (process.platform) {
    case 'win32':
      return [
        extraResolve('win/scrcpy'),
        extraResolve(`win-${process.arch}/scrcpy`),
        extraResolve(`win-${process.arch}`),
        extraResolve('win'),
      ]
    case 'darwin':
      return [
        extraResolve(`mac-${process.arch}/scrcpy`),
        extraResolve(`mac-${process.arch}`),
        extraResolve('mac/scrcpy'),
        extraResolve('mac'),
      ]
    case 'linux':
      return [
        extraResolve(`linux-${process.arch}/scrcpy`),
        extraResolve(`linux-${process.arch}`),
        extraResolve('linux/scrcpy'),
        extraResolve('linux'),
      ]
    default:
      return []
  }
}

export function getBundledAdbPath() {
  return firstExisting(getBundledPlatformDirs().map(dir => join(dir, adbBinary)))
}

export function getBundledScrcpyPath() {
  return firstExisting(getBundledPlatformDirs().map(dir => join(dir, scrcpyBinary)))
}

/**
 * Resolve adb from the original system PATH, ignoring bundled PATH injection.
 * Result is cached for the process lifetime unless cleared.
 */
export function resolveSystemAdbPath({ force = false } = {}) {
  if (!force && cachedSystemAdbPath !== undefined) {
    return cachedSystemAdbPath
  }

  cachedSystemAdbPath = whichResolve('adb', systemPathEnv) ?? null
  return cachedSystemAdbPath
}

export function clearSystemAdbPathCache() {
  cachedSystemAdbPath = undefined
}

/**
 * Prefer bundled binaries over PATH/Scoop/SDK to avoid multi-adb daemon fights.
 * Explicit store paths only win when they themselves point at bundled tools.
 */
export function getScrcpyPath({ store = electronStore, onlyStore, onlyDefault } = {}) {
  if (onlyStore) {
    return store.get('common.scrcpyPath')
  }

  if (onlyDefault) {
    return getDefaultScrcpyPath()
  }

  const stored = resolveStoredPath(store, 'common.scrcpyPath')
  const bundled = getBundledScrcpyPath()

  if (stored && isBundledPath(stored)) {
    return stored
  }

  if (bundled) {
    return bundled
  }

  return stored ?? getDefaultScrcpyPath()
}

export function getAdbPath({ store = electronStore, onlyStore, onlyDefault } = {}) {
  if (onlyStore) {
    return store.get('common.adbPath')
  }

  if (onlyDefault) {
    return getDefaultAdbPath()
  }

  const stored = resolveStoredPath(store, 'common.adbPath')
  const bundled = getBundledAdbPath()

  if (stored && isBundledPath(stored)) {
    return stored
  }

  if (bundled) {
    return bundled
  }

  return stored ?? getDefaultAdbPath()
}

export function getGnirehtetPath({ store = electronStore, onlyStore, onlyDefault } = {}) {
  if (onlyStore) {
    return store.get('common.gnirehtetPath')
  }

  if (onlyDefault) {
    return getDefaultGnirehtetPath()
  }

  return resolveStoredPath(store, 'common.gnirehtetPath') ?? getDefaultGnirehtetPath()
}

export function getDefaultScrcpyPath() {
  return getBundledScrcpyPath() ?? whichResolve('scrcpy')
}

export function getDefaultAdbPath() {
  return getBundledAdbPath() ?? resolveSystemAdbPath() ?? whichResolve('adb')
}

export function getDefaultGnirehtetPath() {
  return whichResolve('gnirehtet')
}
