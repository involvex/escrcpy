/**
 * Pure parsers for Android package management shell output.
 * No side effects — trivially testable.
 */

/**
 * Parse `pm list packages -f` output
 * @param {string} stdout
 * @returns {{ name: string, apkPath: string }[]}
 */
export function parsePackageList(stdout) {
  return String(stdout ?? '')
    .split(/\r?\n/)
    .reduce((list, line) => {
      const value = line.trim()

      if (!value.startsWith('package:')) {
        return list
      }

      const body = value.slice('package:'.length)
      const separatorIndex = body.lastIndexOf('=')

      if (separatorIndex <= 0) {
        return list
      }

      const apkPath = body.slice(0, separatorIndex)
      const name = body.slice(separatorIndex + 1)

      if (!name || !apkPath) {
        return list
      }

      list.push({ name, apkPath })
      return list
    }, [])
}

/**
 * Parse plain `pm list packages [-3|-s|-d]` output (names only)
 * @param {string} stdout
 * @returns {string[]}
 */
export function parsePackageNames(stdout) {
  return String(stdout ?? '')
    .split(/\r?\n/)
    .reduce((list, line) => {
      const value = line.trim()

      if (!value.startsWith('package:')) {
        return list
      }

      const name = value.slice('package:'.length)

      if (name) {
        list.push(name)
      }

      return list
    }, [])
}

function parseTimestamp(value) {
  const match = String(value ?? '').match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)
  return match ? match[1] : ''
}

/**
 * Parse a single package block from `dumpsys package` output
 * @param {string[]} lines - Lines belonging to one package block (excluding header)
 * @returns {{ versionName: string, versionCode: string, firstInstallTime: string, lastUpdateTime: string, installerPackageName: string, permissions: string[] }}
 */
export function parseDumpsysBlock(lines) {
  const info = {
    versionName: '',
    versionCode: '',
    firstInstallTime: '',
    lastUpdateTime: '',
    installerPackageName: '',
    permissions: [],
  }

  let inPermissions = false

  for (const rawLine of lines) {
    const line = rawLine.trim()

    inPermissions = handlePermissionSection(info, line, inPermissions)

    const versionName = line.match(/^versionName=(.+)$/)
    if (versionName && !info.versionName) {
      info.versionName = versionName[1].trim()
      continue
    }

    const versionCode = line.match(/versionCode=(\d+)/)
    if (versionCode && !info.versionCode) {
      info.versionCode = versionCode[1]
      continue
    }

    const firstInstallTime = line.match(/^firstInstallTime=(.+)$/)
    if (firstInstallTime && !info.firstInstallTime) {
      info.firstInstallTime = parseTimestamp(firstInstallTime[1])
      continue
    }

    const lastUpdateTime = line.match(/^lastUpdateTime=(.+)$/)
    if (lastUpdateTime && !info.lastUpdateTime) {
      info.lastUpdateTime = parseTimestamp(lastUpdateTime[1])
      continue
    }

    const installer = line.match(/^installerPackageName=(.*)$/)
    if (installer && !info.installerPackageName) {
      info.installerPackageName = installer[1].trim()
    }
  }

  return info
}

function handlePermissionSection(info, line, inPermissions) {
  if (/^requested permissions:$/.test(line)) {
    return true
  }

  if (!inPermissions) {
    return inPermissions
  }

  // A non-identifier line ends the permissions section
  if (!/^[A-Z]\w*(?:\.\w+)+$/i.test(line)) {
    return false
  }

  info.permissions.push(line)
  return true
}

/**
 * Parse the full bulk `dumpsys package` output into per-package info.
 * Keeps the FIRST occurrence of each package (main "Packages:" section wins).
 * @param {string} stdout
 * @returns {Record<string, ReturnType<parseDumpsysBlock>>}
 */
export function parseDumpsysPackages(stdout) {
  const result = {}
  let currentName = null
  let currentLines = []

  const flush = () => {
    if (!currentName || currentLines.length === 0) {
      return
    }

    if (!result[currentName]) {
      result[currentName] = parseDumpsysBlock(currentLines)
    }
  }

  for (const rawLine of String(stdout ?? '').split(/\r?\n/)) {
    const header = rawLine.match(/^\s*Package \[(.+?)\]/)

    if (header) {
      flush()
      currentName = header[1]
      currentLines = []
      continue
    }

    if (currentName) {
      currentLines.push(rawLine)
    }
  }

  flush()

  return result
}

/**
 * Parse `ls -l <dir>` output into regular-file entries with sizes
 * @param {string} stdout
 * @returns {{ name: string, size: number }[]}
 */
export function parseLsOutput(stdout) {
  return String(stdout ?? '')
    .split(/\r?\n/)
    .reduce((list, line) => {
      const value = line.trim()
      const match = value.match(/^-\S+\s+\S+\s+\S+\s+\S+\s+(\d+)\s+(.*)$/)

      if (!match) {
        return list
      }

      const size = Number.parseInt(match[1], 10)
      const rest = match[2]
      const name = rest.split(/\s+/).pop()

      if (!name || ['.', '..'].includes(name) || Number.isNaN(size)) {
        return list
      }

      list.push({ name, size })
      return list
    }, [])
}
