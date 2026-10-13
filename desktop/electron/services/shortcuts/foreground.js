/**
 * Foreground-window awareness for mirror shortcuts.
 *
 * scrcpy mirror windows are external native processes, not Electron
 * BrowserWindows. Focusing one fires `browser-window-blur`, so the gated
 * shortcut logic would unregister OS-wide hotkeys exactly when the user is
 * interacting with the mirror. Polling the OS foreground window lets us
 * keep hotkeys registered while the mirror (or our own app) is frontmost
 * while still releasing keys to browsers/other apps.
 *
 * The pure matchers stay dependency-free for vitest; only `probeForeground`
 * touches the native `active-win` module, lazily and failure-safe.
 */

const MIRROR_TITLE_SUFFIX = '-escrcpy'

/**
 * Extract a device serial from a mirror window title.
 * Titles look like `Pixel[ABC123]-Mirror-Escrcpy`.
 * @param {string} title
 * @returns {string|null}
 */
export function extractSerialFromTitle(title) {
  if (!title || typeof title !== 'string') {
    return null
  }
  const match = title.match(/\[(.+?)\]/)
  const serial = match?.[1]?.trim()
  return serial || null
}

/**
 * Whether a foreground window belongs to a scrcpy mirror process.
 * Owner-name check covers custom `--window-title` overrides; the title
 * suffix check covers renamed binaries.
 * @param {{ title?: string, owner?: { name?: string, path?: string } }|null|undefined} win
 * @returns {boolean}
 */
export function isMirrorWindow(win) {
  if (!win) {
    return false
  }
  const ownerName = String(win.owner?.name || '').toLowerCase()
  const ownerPath = String(win.owner?.path || '').toLowerCase()
  if (
    ownerName === 'scrcpy'
    || ownerName === 'scrcpy.exe'
    || ownerPath.includes('scrcpy')
  ) {
    return true
  }
  const title = String(win.title || '').toLowerCase()
  return title.endsWith(MIRROR_TITLE_SUFFIX)
}

/**
 * Classify a foreground window against the active mirror set.
 * @param {{ title?: string, owner?: { name?: string, path?: string } }|null|undefined} win
 * @param {Array<string>} [activeSerials]
 * @returns {{ isMirrorForeground: boolean, foregroundSerial: string|null }}
 */
export function classifyForegroundWindow(win, activeSerials = []) {
  if (!isMirrorWindow(win)) {
    return { isMirrorForeground: false, foregroundSerial: null }
  }
  const actives = (activeSerials || []).map(s => String(s))
  if (actives.length === 0) {
    return { isMirrorForeground: false, foregroundSerial: null }
  }
  const fromTitle = extractSerialFromTitle(win?.title)
  if (fromTitle && actives.includes(fromTitle)) {
    return { isMirrorForeground: true, foregroundSerial: fromTitle }
  }
  // Mirror frontmost but serial unresolvable (custom title): still a mirror,
  // target resolution falls back to focus/newest active elsewhere.
  return { isMirrorForeground: true, foregroundSerial: null }
}

/**
 * Choose the prebuilt binding directory for this runtime from the entries
 * of active-win's lib/binding folder. Pure (no fs) so it stays testable.
 * Prefers an exact platform/arch match, falls back to any napi build.
 * @param {Array<string>} dirNames
 * @param {{ platform?: string, arch?: string }} [runtime]
 * @returns {string|null}
 */
export function selectBindingDir(dirNames, runtime = {}) {
  const entries = (dirNames || []).filter(name => typeof name === 'string' && name.startsWith('napi-'))
  if (entries.length === 0) {
    return null
  }
  const platform = runtime.platform || (typeof process !== 'undefined' ? process.platform : '')
  const arch = runtime.arch || (typeof process !== 'undefined' ? process.arch : '')
  const exact = entries.find(name => name.includes(`-${platform}-`) && name.endsWith(`-${arch}`))
  return exact || entries[0]
}

/**
 * Load the native addon directly, bypassing active-win's @mapbox/node-pre-gyp
 * lookup. node-pre-gyp is only a transitive optional dependency and is often
 * absent (bun skips its install), and its absence makes the public API fail
 * silently via a stub. Resolving the package dir never executes the package,
 * so this is safe even when @mapbox is missing.
 * @returns {Promise<{ getActiveWindow?: Function }|null>}
 */
async function loadBindingDirect() {
  try {
    const { createRequire } = await import('node:module')
    const path = await import('node:path')
    const fs = await import('node:fs')
    // eslint-disable-next-line no-undef
    const require = createRequire(import.meta.url)
    const pkgJson = require.resolve('active-win/package.json')
    const bindingRoot = path.join(path.dirname(pkgJson), 'lib', 'binding')
    const entries = fs.readdirSync(bindingRoot)
    const dir = selectBindingDir(entries)
    if (!dir) {
      return null
    }
    const file = path.join(bindingRoot, dir, 'node-active-win.node')
    if (!fs.existsSync(file)) {
      return null
    }
    return require(file)
  }
  catch {
    return null
  }
}
/**
 * Best-effort foreground probe. Never throws. `unavailable` is true when
 * detection itself is broken (missing native binding, unsupported
 * platform) as opposed to a genuine "another app is frontmost" — callers
 * must keep the gate closed in both cases but should log the former once:
 * it is the only symptom of a dead probe, and active-win fails silently
 * (missing binding resolves to a stub returning undefined).
 * Tries the public API first, then a direct binding load that does not
 * need @mapbox/node-pre-gyp.
 * @param {Array<string>} [activeSerials]
 * @returns {Promise<{ isMirrorForeground: boolean, foregroundSerial: string|null, unavailable: boolean }>}
 */
export async function probeForeground(activeSerials = []) {
  const negative = { isMirrorForeground: false, foregroundSerial: null, unavailable: false }
  try {
    const { activeWindow } = await import('active-win')
    const win = await activeWindow?.({ accessibilityPermission: false, screenRecordingPermission: false })
    if (win) {
      return { ...classifyForegroundWindow(win, activeSerials), unavailable: false }
    }
  }
  catch {
    // fall through to the direct binding load below
  }
  try {
    const addon = await loadBindingDirect()
    const win = addon?.getActiveWindow?.()
    if (win) {
      return { ...classifyForegroundWindow(win, activeSerials), unavailable: false }
    }
  }
  catch {
    // unavailable below
  }
  return { ...negative, unavailable: true }
}
