import fs from 'node:fs'
import { app } from 'electron'
import { compare } from 'compare-versions'
import electronStore from '$electron/helpers/store/index.js'
import { setupEnvPath } from './helper.js'

const currentVersion = app.getVersion()
const storedVersion = electronStore.get('version') || '0.0.0'

// Helper to clear a stored tool path if it is missing or looks like a build-directory path
function clearIfInvalidOrBuildPath(key) {
  const value = electronStore.get(key)
  if (!value) {
    return
  }

  // Clear absolute paths that reference build/output directories - these break
  // when the app is moved or rebuilt. Always re-resolve from defaults.
  if (/\\(dist-release|dist-release-new|dist-electron|dist)\\.*\\(win|mac|linux)(-x64|-arm64)?\\/.test(value)
    || /\/(dist-release|dist-release-new|dist-electron|dist)\/.*\/(win|mac|linux)(-x64|-arm64)?\//.test(value)) {
    electronStore.delete(key)
    return
  }

  // Clear paths that no longer exist on disk (e.g. user moved the build)
  if (!fs.existsSync(value)) {
    electronStore.delete(key)
  }
}

if (compare(currentVersion, storedVersion, '!=')) {
  electronStore.delete('common.scrcpyPath')
  electronStore.delete('common.adbPath')
  electronStore.delete('common.gnirehtetPath')
  electronStore.set('version', currentVersion)
}
else {
  // Same version, but still validate stored paths each launch so stale
  // absolute paths from prior builds do not silently break the app.
  clearIfInvalidOrBuildPath('common.scrcpyPath')
  clearIfInvalidOrBuildPath('common.adbPath')
  clearIfInvalidOrBuildPath('common.gnirehtetPath')
}

setupEnvPath()
