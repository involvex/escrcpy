/**
 * Run `fn` when the app is about to quit.
 *
 * Safe to import from main, preload, or renderer bundles: neither `electron`
 * nor `@electron-toolkit/preload` is statically imported here, so no
 * renderer-only (`ipcRenderer`) or main-only (`app`) named ESM import can leak
 * into the wrong bundle. A leaked `ipcRenderer` import crashes the main
 * process at startup (`SyntaxError: ... does not provide an export named
 * 'ipcRenderer'`), because the main bundle is a single ESM file.
 *
 * - main (`process.type === 'browser'`): hooks `app` `will-quit`.
 * - preload/renderer: listens for the `quit-before` message the main process
 *   broadcasts via `webContents.send('quit-before')` before quitting.
 * @param {Function} fn cleanup callback
 */
export function onQuitBefore(fn) {
  if (typeof process !== 'undefined' && process?.type === 'browser') {
    import('electron').then(
      electron => electron?.app?.once?.('will-quit', fn),
      () => {},
    )
    return
  }

  import('@electron-toolkit/preload').then(
    ({ electronAPI }) => electronAPI?.ipcRenderer?.on?.('quit-before', fn),
    () => {},
  )
}
