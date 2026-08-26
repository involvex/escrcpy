import { sheller } from '$electron/helpers/shell/index.js'
import { assertSafePackageName, assertSafeSerial, sanitizeDisplayText, sanitizeFilePath } from '$electron/helpers/shell/safe-args.js'
import commandHelper from '$renderer/utils/command/index.js'
import electronStore from '$electron/helpers/store/index.js'

import { ProcessManager } from '$electron/process/manager.js'

import { parseDisplayIds, parseScrcpyAppList, parseScrcpyCameras, parseScrcpyCodecList } from './helper.js'

const processManager = new ProcessManager()

function normalizeScrcpyError(error) {
  const message = error?.stderr || error?.message
  throw new Error(message)
}

function createScrcpyProcess(command, options = {}) {
  let scrcpyProcess = null

  scrcpyProcess = sheller(`scrcpy ${command}`, {
    shell: true,
    encoding: 'utf8',
    ...options,
    stderr: (data) => {
      options?.stderr?.(data, scrcpyProcess)
    },
  })

  processManager.add(scrcpyProcess)

  const promise = scrcpyProcess.catch(normalizeScrcpyError)

  return Object.assign(scrcpyProcess, {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  })
}

function createMirrorProcess(
  serial,
  { title, args = '', ...options } = {},
) {
  assertSafeSerial(serial)

  return createScrcpyProcess(
    `--serial="${serial}" --window-title="${sanitizeDisplayText(title)}" ${args}`,
    options,
  )
}

async function shell(...args) {
  return createScrcpyProcess(...args)
}

async function getEncoders(serial) {
  assertSafeSerial(serial)
  const res = await createScrcpyProcess(`--serial="${serial}" --list-encoders`)

  const stdout = res.stdout

  const value = parseScrcpyCodecList(stdout)

  return value
}

async function mirror(serial, options = {}) {
  electronStore.set('lastConnectedDevice', {
    id: serial,
    timestamp: Date.now(),
  })
  return createMirrorProcess(serial, options)
}

async function record(serial, { title, args = '', savePath, ...options } = {}) {
  assertSafeSerial(serial)

  return createScrcpyProcess(
    `--serial="${serial}" --window-title="${sanitizeDisplayText(title)}" --record="${sanitizeFilePath(savePath)}" ${args}`,
    options,
  )
}

async function helper(
  serial,
  command = '',
  options = {},
) {
  assertSafeSerial(serial)

  const stringCommand = commandHelper.stringify(command)

  return createScrcpyProcess(
    `--serial="${serial}" --no-window --no-video --no-audio ${stringCommand}`,
    options,
  )
}

async function getAppList(serial) {
  assertSafeSerial(serial)
  const res = await createScrcpyProcess(`--serial="${serial}" --list-apps`)

  const stdout = res.stdout

  const value = parseScrcpyAppList(stdout)

  return value
}

async function getDisplayIds(serial) {
  assertSafeSerial(serial)
  const res = await createScrcpyProcess(`--serial="${serial}" --list-displays`)

  const stdout = res.stdout

  const value = parseDisplayIds(stdout)

  return value
}

async function getCameraList(serial, options) {
  assertSafeSerial(serial)
  const res = await createScrcpyProcess(`--serial="${serial}" --list-cameras`)

  const stdout = res.stdout

  const value = parseScrcpyCameras(stdout, options)

  return value
}

async function launch(serial, args = {}) {
  let { commands = '', packageName, useNewDisplay = true, newDisplay = '', landscape, ...options } = args

  assertSafeSerial(serial)

  if (useNewDisplay) {
    commands += newDisplay
      ? ` --new-display=${newDisplay}`
      : ' --new-display'
  }

  if (landscape || !useNewDisplay) {
    commands = commands.replace(/\s*--flex-display\s*/g, ' ')
  }

  if (packageName && !['unknown'].includes(packageName)) {
    assertSafePackageName(packageName)
    commands += ` --start-app=${packageName}`
  }

  const promise = {
    resolve: null,
  }

  const signalText = /New display:.+?\(id=(\d+)\)/i

  const child = createMirrorProcess(serial, {
    ...options,
    args: commands,
    stdout: (data) => {
      const matchList = data.match(signalText)

      if (!matchList?.length) {
        return false
      }

      const displayId = matchList[1]

      if (!displayId && useNewDisplay) {
        throw new Error('The display ID was not obtained.')
      }

      promise?.resolve?.(displayId)
    },
  })

  return new Promise((resolve, reject) => {
    let settled = false

    function resolveOnce(value) {
      if (settled) {
        return
      }

      settled = true
      resolve(value)
    }

    function rejectOnce(error) {
      if (settled) {
        return
      }

      settled = true
      reject(error)
    }

    promise.resolve = resolveOnce

    if (!useNewDisplay) {
      child.once('spawn', () => {
        resolveOnce()
      })
    }

    child.then(resolveOnce).catch(rejectOnce)
  })
}

async function killProcesses() {
  return processManager.kill()
}

async function quickMirror(deviceId, options = {}) {
  electronStore.set('lastConnectedDevice', {
    id: deviceId,
    timestamp: Date.now(),
  })
  return createMirrorProcess(deviceId, options)
}

export default {
  shell,
  getEncoders,
  mirror,
  record,
  launch,
  helper,
  getAppList,
  getDisplayIds,
  getCameraList,
  killProcesses,
  quickMirror,
}
