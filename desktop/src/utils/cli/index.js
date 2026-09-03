/**
 * Pure helpers for the headless `escrcpy` CLI: argument parsing, adb/scrcpy
 * command building, and `adb devices -l` output parsing.
 */

const CLI_COMMANDS = new Set([
  'devices',
  'mirror',
  'shot',
  'install',
  'record',
  'shell',
  'push',
  'pull',
  'connect',
  'disconnect',
  'battery',
  'logcat',
])

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
    host: '',
    local: '',
    remote: '',
    shellCmd: [],
    clear: false,
    dump: false,
    timeoutMs: 0,
    waitForDevice: false,
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
      case '--wait-for-device':
        parsed.waitForDevice = true
        break
      case '--timeout': {
        const raw = args.shift() || ''
        const ms = Number(raw)
        if (!Number.isFinite(ms) || ms <= 0) {
          return { ...parsed, error: '--timeout: milliseconds required' }
        }
        parsed.timeoutMs = Math.floor(ms)
        break
      }
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

  if (command === 'connect' || command === 'disconnect') {
    parsed.host = args.shift() || ''
    if (!parsed.host) {
      return { ...parsed, error: `${command}: host[:port] required` }
    }
    if (args.length > 0) {
      return { ...parsed, error: `${command}: unexpected argument: ${args[0]}` }
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
      else if (flag === '--wait-for-device') {
        parsed.waitForDevice = true
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

  if (command === 'record') {
    const rest = []
    while (args.length > 0) {
      const token = args.shift()
      if (token === '-o' || token === '--out') {
        if (parsed.out) {
          return { ...parsed, error: 'record: duplicate output flag' }
        }
        parsed.out = args.shift() || ''
        if (!parsed.out) {
          return { ...parsed, error: 'record: output file required (-o out.mp4)' }
        }
      }
      else if (token === '--wait-for-device') {
        parsed.waitForDevice = true
      }
      else {
        rest.push(token)
      }
    }
    if (!parsed.out) {
      return { ...parsed, error: 'record: output file required (-o out.mp4)' }
    }
    parsed.scrcpyArgs = rest
    return parsed
  }

  if (command === 'shell') {
    const rest = [...args]
    if (rest[0] === '--') {
      rest.shift()
    }
    if (!rest.length) {
      return { ...parsed, error: 'shell: command required' }
    }
    parsed.shellCmd = rest
    return parsed
  }

  if (command === 'push') {
    parsed.local = args.shift() || ''
    if (!parsed.local) {
      return { ...parsed, error: 'push: local path required' }
    }
    parsed.remote = args.shift() || '/sdcard/Download/'
    if (args.length > 0) {
      return { ...parsed, error: `push: unexpected argument: ${args[0]}` }
    }
    return parsed
  }

  if (command === 'pull') {
    parsed.remote = args.shift() || ''
    if (!parsed.remote) {
      return { ...parsed, error: 'pull: remote path required' }
    }
    parsed.local = args.shift() || ''
    if (args.length > 0) {
      return { ...parsed, error: `pull: unexpected argument: ${args[0]}` }
    }
    return parsed
  }

  if (command === 'battery') {
    while (args.length > 0) {
      const flag = args.shift()
      if (flag === '--json') {
        parsed.json = true
      }
      else {
        return { ...parsed, error: `Unknown battery flag: ${flag}` }
      }
    }
    return parsed
  }

  if (command === 'logcat') {
    while (args.length > 0) {
      const flag = args.shift()
      if (flag === '--clear' || flag === '-c') {
        parsed.clear = true
      }
      else if (flag === '--dump' || flag === '-d') {
        parsed.dump = true
      }
      else if (flag === '-o' || flag === '--out') {
        parsed.out = args.shift() || ''
      }
      else if (flag === '--json') {
        parsed.json = true
      }
      else {
        return { ...parsed, error: `Unknown logcat flag: ${flag}` }
      }
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
 * @param {'devices'|'shot'|'install'|'shell'|'push'|'pull'|'connect'|'disconnect'|'battery'|'logcat-clear'|'logcat'|'wait-for-device'} kind
 * @param {string} [serial]
 * @param {string} [apk]
 * @param {Object} [options]
 */
export function buildAdbArgs(kind, serial, apk, options = {}) {
  switch (kind) {
    case 'devices':
      return ['devices', '-l']
    case 'shot':
      return ['-s', serial, 'exec-out', 'screencap', '-p']
    case 'install':
      return ['-s', serial, 'install', '-r', apk]
    case 'shell':
      return ['-s', serial, 'shell', ...(options.shellCmd || [])]
    case 'push':
      return ['-s', serial, 'push', options.local || apk, options.remote || '/sdcard/Download/']
    case 'pull':
      return ['-s', serial, 'pull', options.remote || apk, ...(options.local ? [options.local] : [])]
    case 'connect':
      return ['connect', serial]
    case 'disconnect':
      return ['disconnect', serial]
    case 'battery':
      return ['-s', serial, 'shell', 'dumpsys', 'battery']
    case 'logcat-clear':
      return ['-s', serial, 'logcat', '-c']
    case 'logcat':
      return ['-s', serial, 'logcat', ...(options.dump ? ['-d'] : [])]
    case 'wait-for-device':
      return ['-s', serial, 'wait-for-device']
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

/**
 * @param {string} serial
 * @param {string} out
 * @param {string[]} [extra]
 */
export function buildScrcpyRecordArgs(serial, out, extra = []) {
  return ['-s', serial, `--record=${out}`, ...extra]
}
