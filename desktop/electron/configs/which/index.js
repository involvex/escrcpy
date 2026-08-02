import fs from 'node:fs'
import { whichResolve } from '$electron/process/resources.js'
import electronStore from '$electron/helpers/store/index.js'

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

export function getScrcpyPath({ store = electronStore, onlyStore, onlyDefault } = {}) {
  if (onlyStore) {
    return store.get('common.scrcpyPath')
  }

  if (onlyDefault) {
    return getDefaultScrcpyPath()
  }

  return resolveStoredPath(store, 'common.scrcpyPath') ?? getDefaultScrcpyPath()
}

export function getAdbPath({ store = electronStore, onlyStore, onlyDefault } = {}) {
  if (onlyStore) {
    return store.get('common.adbPath')
  }

  if (onlyDefault) {
    return getDefaultAdbPath()
  }

  // Prefer user-installed adb from PATH (more stable across updates)
  // Fall back to stored path if valid, then bundled default
  return whichResolve('adb') ?? resolveStoredPath(store, 'common.adbPath') ?? getDefaultAdbPath()
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
  return whichResolve('scrcpy')
}

export function getDefaultAdbPath() {
  return whichResolve('adb')
}

export function getDefaultGnirehtetPath() {
  return whichResolve('gnirehtet')
}
