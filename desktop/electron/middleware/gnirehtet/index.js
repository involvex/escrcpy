import { onQuitBefore } from '$electron/helpers/lifecycle/index.js'
import electronStore from '$electron/helpers/store/index.js'

import adb from '$electron/middleware/adb/index.js'

import { ProcessManager } from '$electron/process/manager.js'
import { sheller } from '$electron/helpers/shell/index.js'
import { assertSafeSerial, assertSafeShellArgument } from '$electron/helpers/shell/safe-args.js'

const processManager = new ProcessManager()

const FGS_TIMEOUT_HINT
  = 'Gnirehtet VPN service timed out starting (ForegroundServiceDidNotStartInTime). '
    + 'Approve the VPN prompt on the device, disable battery restrictions for Gnirehtet, then retry. '
    + 'If the client is broken, enable "Gnirehtet Fix" once to reinstall.'

onQuitBefore(async () => {
  stop().catch((error) => {
    console.warn(error.message || 'Stop service failure')
  })
})

function enhanceGnirehtetError(error) {
  const message = String(error?.stderr || error?.message || error || '')
  if (/ForegroundServiceDidNotStartInTime|startForeground/i.test(message)) {
    return new Error(`${message}\n\n${FGS_TIMEOUT_HINT}`)
  }
  return new Error(message)
}

function normalizeGnirehtetError(error) {
  throw enhanceGnirehtetError(error)
}

async function shell(command, options = {}) {
  const gnirehtetProcess = sheller(`gnirehtet ${command}`, {
    shell: true,
    encoding: 'utf8',
    ...options,
  })

  processManager.add(gnirehtetProcess)

  const promise = gnirehtetProcess.catch(normalizeGnirehtetError)

  return Object.assign(gnirehtetProcess, {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  })
}

function install(deviceId) {
  assertSafeSerial(deviceId)
  return shell(`install "${deviceId}"`)
}

function start(deviceId, options = {}) {
  assertSafeSerial(deviceId)
  if (options.append) {
    assertSafeShellArgument(options.append, 'gnirehtet append')
  }
  const append = options.append ? ` ${options.append}` : ''

  return shell(`start "${deviceId}"${append}`)
}

async function stop(deviceId) {
  await processManager.kill()
  if (deviceId) {
    assertSafeSerial(deviceId)
  }
  const command = deviceId ? ` "${deviceId}"` : ''
  return shell(`stop${command}`)
}

function tunnel(deviceId) {
  assertSafeSerial(deviceId)
  return shell(`tunnel "${deviceId}"`)
}

async function isInstalled(deviceId) {
  try {
    const res = await adb.isInstalled(deviceId, 'com.genymobile.gnirehtet')
    return res
  }
  catch (error) {
    console.warn(error?.message || error)
    return false
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function relay() {
  return new Promise((resolve, reject) => {
    shell('relay', {
      stdout: (data) => {
        if (data.includes('Relay server started') || /already (running|started)/i.test(data)) {
          resolve(data)
        }
      },
      stderr: (error) => {
        const text = String(error || '')
        // Soft-handle relay already bound / already running
        if (/already|Address already in use|bind/i.test(text)) {
          resolve(text)
          return
        }
        reject(error)
      },
    }).catch((error) => {
      const text = String(error?.message || error || '')
      if (/already|Address already in use|bind/i.test(text)) {
        resolve(text)
        return
      }
      reject(error)
    })
  })
}

/**
 * Prefer install-once. gnirehtetFix only forces reinstall when the client is missing
 * or the previous start failed with an install-related error — not on every start.
 */
async function ensureClientInstalled(deviceId, { forceReinstall = false } = {}) {
  const installed = await isInstalled(deviceId)

  if (installed && !forceReinstall) {
    return false
  }

  await install(deviceId).catch((error) => {
    throw enhanceGnirehtetError(
      error?.message ? error : new Error(error?.message || 'Gnirehtet Install Client fail'),
    )
  })

  // Give PackageManager / VPN stack a moment after install before startForeground
  await delay(800)
  return true
}

async function run(deviceId) {
  await stop(deviceId).catch((error) => {
    console.warn(error.message || 'Stop service failure')
  })

  await relay().catch((error) => {
    throw enhanceGnirehtetError(
      error?.message ? error : new Error(error?.message || 'Gnirehtet Relay fail'),
    )
  })

  const gnirehtetFix = electronStore.get('common.gnirehtetFix') || false
  // Fix mode: reinstall only if not installed, or as a one-shot repair when start fails below
  await ensureClientInstalled(deviceId, { forceReinstall: false })

  const gnirehtetAppend = electronStore.get('common.gnirehtetAppend')

  try {
    await start(deviceId, { append: gnirehtetAppend })
  }
  catch (error) {
    const message = String(error?.message || error || '')
    const shouldRepair = gnirehtetFix
      || /not installed|INSTALL_|ForegroundServiceDidNotStartInTime|startForeground/i.test(message)

    if (!shouldRepair) {
      throw enhanceGnirehtetError(error)
    }

    // One-shot repair: reinstall client, settle, retry start once
    await ensureClientInstalled(deviceId, { forceReinstall: true })
    await start(deviceId, { append: gnirehtetAppend }).catch((retryError) => {
      throw enhanceGnirehtetError(retryError)
    })
  }
}

async function killProcesses() {
  await processManager.kill()
}

export default {
  shell,
  relay,
  install,
  isInstalled,
  start,
  stop,
  tunnel,
  run,
  killProcesses,
}
