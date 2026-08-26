/**
 * Shell-argument safety helpers shared by the scrcpy and adb middleware.
 *
 * Commands are built as interpolated strings and spawned with `shell: true`,
 * so any value containing quotes or shell metacharacters could break out of
 * its quoting and execute arbitrary commands.
 */

const SHELL_UNSAFE_PATTERN = /['"\\;$&|<>()`]/

const SERIAL_PATTERN = /^[\w.:-]+$/

const PACKAGE_NAME_PATTERN = /^[a-z][\w$]*(?:\.[\w$]+)+$/i

const DISPLAY_TEXT_UNSAFE_PATTERN = /['"\\;$&|<>()`^%!]/g

const CONTROL_WHITESPACE_PATTERN = /[\r\n\t]+/g

/**
 * @param {unknown} value
 * @returns {boolean} true when the value contains no shell metacharacters
 */
export function isSafeShellArgument(value) {
  return !SHELL_UNSAFE_PATTERN.test(String(value))
}

/**
 * @param {unknown} value
 * @param {string} [label]
 * @returns {string} the original value when safe
 * @throws {Error} when the value contains shell metacharacters
 */
export function assertSafeShellArgument(value, label = 'shell argument') {
  if (!isSafeShellArgument(value)) {
    throw new Error(`Unsafe ${label} rejected: ${value}`)
  }

  return String(value)
}

/**
 * Adb serials are single whitespace-delimited tokens (USB ids, `ip:port`,
 * `emulator-5554`), so a strict allowlist is safe here.
 * @param {unknown} serial
 * @returns {string} the original serial when safe
 * @throws {Error}
 */
export function assertSafeSerial(serial) {
  if (typeof serial !== 'string' || !SERIAL_PATTERN.test(serial)) {
    throw new Error(`Unsafe device serial rejected: ${serial}`)
  }

  return serial
}

/**
 * Sanitizes user-editable display text (device names, remarks) so it can be
 * safely quoted into a command while keeping readable characters, including
 * non-ASCII ones.
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeDisplayText(value) {
  const sanitized = String(value ?? '')
    .replace(CONTROL_WHITESPACE_PATTERN, ' ')
    .replace(DISPLAY_TEXT_UNSAFE_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()

  return sanitized || 'escrcpy'
}

/**
 * Like sanitizeDisplayText but preserves path structure (`\`, `:`, `/`).
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeFilePath(value) {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/['";$&|<>()`^%!?*[\]{}]/g, '')
    .trim()
}

/**
 * Android package names: dot-separated segments of letters, digits, `_`, `$`
 * (mirrors what the package manager accepts at install time)
 * @param {unknown} pkg
 * @returns {string} the original package name when safe
 * @throws {Error}
 */
export function assertSafePackageName(pkg) {
  if (!PACKAGE_NAME_PATTERN.test(String(pkg))) {
    throw new Error(`Unsafe package name rejected: ${pkg}`)
  }

  return String(pkg)
}
