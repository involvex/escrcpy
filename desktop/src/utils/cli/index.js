/**
 * Pure helpers for the headless `escrcpy` CLI: argument parsing, adb/scrcpy
 * command building, and `adb devices -l` output parsing.
 */

const CLI_COMMANDS = new Set(['devices', 'mirror', 'shot', 'install'])

/**
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {Object} parsed command or `{ error }`
 */
export function parseCliArgs(argv = []) {
  const parsed = {
    command: '',
    serial: '',
    apk: '',
    out: '',
    json: false,
    help: false,
    version: false,
    adbPath: '',
    scrcpyPath: '',
    scrcpyArgs: [],
  }

  const args = [...argv]

  // Help/version win from any position
  if (args.some(arg => arg === '-h' || arg === '--help')) {
    return { ...parsed, help: true, command: 'help' }
  }

  if (args.some(arg => arg === '-v' || arg === '--version')) {
    return { ...parsed, version: true, command: 'version' }
  }

  if (args.length === 0) {
    parsed.command = 'help'
    return parsed
  }

  // Global flags may appear anywhere before the positional tail
  while (args.length > 0 && String(args[0]).startsWith('-')) {
    const flag = args.shift()

    switch (flag) {
      case '--json':
        parsed.json = true
        break
      case '-h':
      case '--help':
        parsed.help = true
        return { ...parsed, command: 'help' }
      case '-v':
      case '--version':
        return { ...parsed, command: 'version' }
      case '--adb':
        parsed.adbPath = args.shift() || ''
        break
      case '--scrcpy':
        parsed.scrcpyPath = args.shift() || ''
        break
      default:
        return { ...parsed, error: `Unknown flag: ${flag}` }
    }
  }

  if (parsed.help) {
    return { ...parsed, command: 'help' }
  }

  const command = args.shift()

  if (command === '-v' || command === '--version') {
    return { ...parsed, command: 'version' }
  }

  if (command === '-h' || command === '--help' || !command) {
    return { ...parsed, command: 'help' }
  }

  if (!CLI_COMMANDS.has(command)) {
    return { ...parsed, error: `Unknown command: ${command}` }
  }

  parsed.command = command

  if (command === 'devices') {
    while (args.length > 0) {
      const flag = args.shift()

      if (flag === '--json') {
        parsed.json = true
      }
      else {
        return { ...parsed, error: `Unknown devices flag: ${flag}` }
      }
    }

    return parsed
  }

  parsed.serial = args.shift() || ''

  if (!parsed.serial) {
    return { ...parsed, error: `${command}: serial required` }
  }

  if (command === 'mirror') {
    parsed.scrcpyArgs = [...args]
    return parsed
  }

  if (command === 'shot') {
    while (args.length > 0) {
      const flag = args.shift()

      if (flag === '-o' || flag === '--out') {
        parsed.out = args.shift() || ''
      }
      else {
        return { ...parsed, error: `Unknown shot flag: ${flag}` }
      }
    }

    if (!parsed.out) {
      parsed.out = `screencap-${parsed.serial}-${Date.now()}.png`
    }

    return parsed
  }

  if (command === 'install') {
    parsed.apk = args.shift() || ''

    if (!parsed.apk) {
      return { ...parsed, error: 'install: apk path required' }
    }

    return parsed
  }

  return parsed
}

const KNOWN_DEVICE_STATES = new Set([
  'device',
  'offline',
  'unauthorized',
  'recovery',
  'bootloader',
  'sideload',
])

/**
 * Parses `adb devices -l` output into structured entries.
 * adb normally separates fields with tabs, but mdns tls entries use spaces.
 * @param {string} output
 * @returns {Array<{ id: string, state: string, details: Record<string, string> }>}
 */
export function parseAdbDevices(output = '') {
  return String(output ?? '')
    .split(/\r?\n/)
    .reduce((list, line) => {
      const tokens = line.trim().split(/\s+/).filter(Boolean)

      if (tokens.length < 2 || !KNOWN_DEVICE_STATES.has(tokens[1])) {
        return list
      }

      const [id, state, ...detailParts] = tokens

      const details = {}

      for (const part of detailParts) {
        const separator = part.indexOf(':')

        if (separator > 0) {
          details[part.slice(0, separator)] = part.slice(separator + 1)
        }
      }

      list.push({ id, state, details })
      return list
    }, [])
}

/**
 * @param {'devices'|'shot'|'install'} kind
 * @param {string} [serial]
 * @param {string} [apk]
 */
export function buildAdbArgs(kind, serial, apk) {
  switch (kind) {
    case 'devices':
      return ['devices', '-l']
    case 'shot':
      return ['-s', serial, 'exec-out', 'screencap', '-p']
    case 'install':
      return ['-s', serial, 'install', '-r', apk]
    default:
      throw new Error(`Unsupported adb command kind: ${kind}`)
  }
}

/**
 * @param {string} serial
 * @param {string[]} [extra]
 */
export function buildScrcpyArgs(serial, extra = []) {
  return ['-s', serial, ...extra]
}
