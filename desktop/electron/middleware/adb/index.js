import fs from 'node:fs'
import path from 'node:path'
import { adbKeyboardApkPath, desktopPath, getDefaultAdbPath } from '$electron/configs/index.js'
import electronStore from '$electron/helpers/store/index.js'
import { Adb } from '@devicefarmer/adbkit'
import pLimit from 'p-limit'
import dayjs from 'dayjs'
import { ProcessManager } from '$electron/process/manager.js'
import { streamToBase64 } from '$electron/helpers/index.js'
import { sheller } from '$electron/helpers/shell/index.js'
import { parseBatteryDump } from './helpers/battery/index.js'
import { ADBDownloader } from './helpers/downloader/index.js'
import adbScanner, { MDNS_CONFIG, probeDeviceCandidates, scanMdnsDevices } from './helpers/scanner/index.js'
import { ADBUploader } from './helpers/uploader/index.js'
import { onQuitBefore } from '$electron/helpers/lifecycle/index.js'
import { readDirWithStat } from './helpers/explorer/index.js'
import { parseDumpsysPackages, parseLsOutput, parsePackageList, parsePackageNames } from './helpers/packages/index.js'
import { setupEnvPath } from '$electron/process/helper.js'
import { assertSafePackageName, assertSafeShellArgument, isSafeShellArgument } from '$electron/helpers/shell/safe-args.js'
import { filterConnectedDevices } from './helpers/index.js'

const processManager = new ProcessManager()

let client = null

const logcatReaders = new Map()

onQuitBefore(() => {
  closeAllLogcats()
  client?.kill?.()
  processManager.kill()
})

electronStore.onDidChange('common.adbPath', async (...args) => {
  const [value, oldValue = getDefaultAdbPath()] = args

  if (value === oldValue) {
    return false
  }

  if (value === client?.options?.bin) {
    return false
  }

  try {
    await client?.kill?.()
    await processManager.kill()
  }
  catch (error) {
    console.warn(error.message)
  }

  init()
})

function normalizeAdbError(error) {
  const message = error?.stderr || error?.message
  throw new Error(message)
}

async function shell(command) {
  const adbProcess = sheller(`adb ${command}`, {
    shell: true,
    encoding: 'utf8',
  })

  processManager.add(adbProcess)

  const promise = adbProcess.catch(normalizeAdbError)

  return Object.assign(adbProcess, {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  })
}

async function deviceShell(id, command) {
  const res = await client.getDevice(id).shell(command).then(Adb.util.readAll)
  return res.toString()
}

async function kill(...params) {
  return client.kill(...params)
}

async function getDeviceIP(id) {
  try {
    assertSafeSerial(id)

    const { stdout } = await shell(`-s ${id} shell ip -f inet addr show wlan0`)
    const reg = /inet ([0-9.]+)\/\d+/
    const match = stdout.match(reg)
    const value = match[1]

    return value
  }
  catch (error) {
    console.warn('adb.getDeviceIP.error', error.message)
  }
}

async function tcpip(id, port = 5555) {
  return client.getDevice(id).tcpip(port)
}

async function screencap(deviceId, options = {}) {
  const { returnBase64 = false } = options

  const device = client.getDevice(deviceId)

  const fileStream = await device.screencap()

  if (!fileStream) {
    throw new Error('Failed to obtain screenshot data')
  }

  if (returnBase64) {
    const base64 = await streamToBase64(fileStream)
    return base64
  }

  const fileName = `Screencap-${dayjs().format('YYYY-MM-DD-HH-mm-ss')}.png`
  const savePath = options.savePath || path.join(electronStore.get('common.savePath') || desktopPath, fileName)

  return new Promise((resolve, reject) => {
    fileStream
      .pipe(fs.createWriteStream(savePath))
      .on('finish', () => {
        resolve(true)
      })
      .on('error', (error) => {
        console.warn(error?.message || error)
        reject(false)
      })
  })
}

async function install(id, path) {
  return client.getDevice(id).install(path)
}

async function uninstall(id, path) {
  return client.getDevice(id).uninstall(path)
}

async function isInstalled(id, pkg) {
  return client.getDevice(id).isInstalled(pkg)
}

async function version() {
  return client.version()
}

async function watch(callback) {
  const tracker = await client.trackDevices()
  tracker.on('add', async (ret) => {
    callback('add', ret)
  })

  tracker.on('remove', (device) => {
    callback('remove', device)
  })

  tracker.on('end', (ret) => {
    callback('end', ret)
  })

  tracker.on('error', (err) => {
    callback('error', err)
  })

  const close = () => tracker.end()

  return close
}

async function readdir(id, currentPath) {
  const device = await client.getDevice(id)

  const value = await readDirWithStat(device, currentPath)

  return value
}

async function push(id, filePath, args = {}) {
  const { progress, savePath = '/sdcard/Download' } = args

  const fileName = path.basename(filePath)

  const fullSavePath = `${savePath}/${fileName}`.replace(/\/+/g, '/')

  const transfer = await client.getDevice(id).push(filePath, fullSavePath)

  return new Promise((resolve, reject) => {
    transfer.on('progress', (stats) => {
      progress?.(stats)
    })

    transfer.on('end', () => {
      resolve(fullSavePath)
    })

    transfer.on('error', (err) => {
      reject(err)
    })
  })
}

async function pull(id, filePath, args = {}) {
  const { progress, savePath = '../' } = args

  const fileName = path.basename(filePath)

  const fullSavePath = path.resolve(savePath, fileName)

  const transfer = await client.getDevice(id).pull(filePath)

  return new Promise((resolve, reject) => {
    transfer.on('progress', (stats) => {
      progress?.(stats)
    })

    transfer.on('end', () => {
      resolve(fullSavePath)
    })

    transfer.on('error', (err) => {
      reject(err)
    })

    transfer.pipe(fs.createWriteStream(fullSavePath))
  })
}

async function scannerConnect(password, options = {}) {
  return adbScanner.connect({
    password,
    adb: {
      pair,
      connect,
      shell,
    },
    ...options,
  })
}

async function discoverConnect(options = {}) {
  const {
    timeout = MDNS_CONFIG.DISCOVER_TIMEOUT,
    probeTimeout = MDNS_CONFIG.PROBE_TIMEOUT,
    ports = MDNS_CONFIG.DEFAULT_PROBE_PORTS,
    concurrency = Number(electronStore.get('common.concurrencyLimit') ?? 5),
    excludeConnected = true,
    onStatus = () => {},
    onDevice = () => {},
  } = options

  const devices = await scanMdnsDevices({
    timeout,
    onStatus,
    onDevice,
  })

  if (!devices.length) {
    return {
      success: false,
      errorCode: 'NO_DEVICES',
      error: 'No wireless debugging devices discovered',
      devices: [],
      results: [],
    }
  }

  const reachableDevices = await probeDeviceCandidates(devices, {
    ports,
    timeout: probeTimeout,
    concurrency,
    onStatus,
    onDevice,
  })

  if (!reachableDevices.length) {
    onStatus('unreachable')

    return {
      success: false,
      errorCode: 'NO_REACHABLE_DEVICES',
      error: 'No reachable ADB ports discovered',
      devices,
      results: [],
    }
  }

  const connectableDevices = await filterConnectedDevices(reachableDevices, {
    client,
    excludeConnected,
  })

  if (!connectableDevices.length) {
    onStatus('connected')

    return {
      success: false,
      errorCode: 'NO_UNCONNECTED_DEVICES',
      error: 'Discovered devices are already connected',
      devices,
      results: [],
    }
  }

  const limit = pLimit(concurrency)
  const results = await Promise.all(
    connectableDevices.map(device =>
      limit(async () => {
        onStatus('connecting', device)

        try {
          const message = await connect(device.address, device.port)
          const result = {
            ...device,
            success: true,
            message,
          }

          onStatus('connected', result)

          return result
        }
        catch (error) {
          const result = {
            ...device,
            success: false,
            message: error?.message || error?.cause?.message || error,
          }

          onStatus('connect-error', result)

          return result
        }
      }),
    ),
  )

  const success = results.some(item => item.success)

  if (!success) {
    onStatus('error')
  }

  return {
    success,
    errorCode: success ? undefined : 'NO_CONNECTED_DEVICES',
    error: success ? undefined : 'Failed to connect discovered devices',
    devices,
    results,
  }
}

async function battery(id) {
  const res = await deviceShell(id, 'dumpsys battery')

  const value = parseBatteryDump(res)

  return value
}

async function pair(host, port, code) {
  const address = port ? `${host}:${port}` : host

  assertSafeShellArgument(address, 'address')
  assertSafeShellArgument(code, 'pairing code')

  const { stderr, stdout } = await shell(`pair ${address} ${code}`)

  if (stderr) {
    throw stderr
  }

  return stdout
}

async function connect(host, port) {
  const address = port ? `${host}:${port}` : host

  assertSafeShellArgument(address, 'address')

  const { stderr, stdout } = await shell(`connect ${address}`)

  if (stderr) {
    throw stderr
  }

  const errorKeys = ['cannot', 'failed']

  if (errorKeys.some(item => stdout.includes(item))) {
    throw stdout
  }

  return stdout
}

async function disconnect(host, port) {
  const address = port ? `${host}:${port}` : host

  assertSafeShellArgument(address, 'address')

  const { stderr, stdout } = await shell(`disconnect ${address}`)

  if (stderr) {
    throw stderr
  }

  return stdout
}

function uploader(options = {}) {
  const { deviceId, localPaths, remotePath = '/sdcard/Download', ...initialOptions } = options

  const uploader = new ADBUploader({
    adb: client,
    onError: (error, file) => {
      console.error(`Error uploading ${file}:`, error)
    },
    ...initialOptions,
  })

  return {
    context: uploader,
    start: () => uploader.uploadTo(
      remotePath,
      localPaths,
      deviceId,
    ),
    cancel: () => uploader.cancel(),
  }
}

function downloader(options = {}) {
  const { deviceId, items, localPath, ...initialOptions } = options

  const downloaderInstance = new ADBDownloader({
    adb: client,
    onError: (error, file) => {
      console.error(`Error downloading ${file}:`, error)
    },
    ...initialOptions,
  })

  return {
    context: downloaderInstance,
    start: () => downloaderInstance.downloadTo(deviceId, items, localPath),
    preview: () => downloaderInstance.previewTasks(deviceId, items),
    cancel: () => downloaderInstance.cancel(),
  }
}

async function waitForDevice(id) {
  const device = client.getDevice(id)

  return device.waitForDevice()
}

async function getSerialNo(id) {
  let value = id

  try {
    const ret = await deviceShell(id, 'getprop ro.serialno')
    value = ret.replace(/[\n\r]/g, '')
  }
  catch (error) {
    console.error('getSerialNo.error', error?.message || error)
  }

  return value
}

async function getScreenSize(id) {
  try {
    const ret = await deviceShell(id, 'wm size')
    // Prefer Override size (user-visible logical resolution), fallback to Physical size
    const overrideMatch = ret.match(/Override size:\s*(\d+)x(\d+)/)
    if (overrideMatch) {
      return { width: Number(overrideMatch[1]), height: Number(overrideMatch[2]) }
    }
    const physicalMatch = ret.match(/Physical size:\s*(\d+)x(\d+)/)
    if (physicalMatch) {
      return { width: Number(physicalMatch[1]), height: Number(physicalMatch[2]) }
    }
  }
  catch (error) {
    console.error('getScreenSize.error', error?.message || error)
  }

  return null
}

async function getDeviceList() {
  const listDevicesWithPaths = await client.listDevicesWithPaths()
  const devices = listDevicesWithPaths.filter(item => !['offline'].includes(item.type))

  const concurrencyLimit = Number(electronStore.get('common.concurrencyLimit') ?? 10)
  const limit = pLimit(concurrencyLimit)

  const value = await Promise.all(
    devices.map(item =>
      limit(async () => {
        const [serialNo, screenSize] = await Promise.all([
          getSerialNo(item.id),
          getScreenSize(item.id),
        ])
        return {
          ...item,
          serialNo,
          screenWidth: screenSize?.width ?? null,
          screenHeight: screenSize?.height ?? null,
        }
      }),
    ),
  )

  return value
}

function init() {
  // Setup the PATH environment variable by injecting necessary tool paths
  setupEnvPath()
  client = Adb.createClient()
}

async function killProcesses() {
  return processManager.kill()
}

export async function isInstalledAdbKeyboard(deviceId) {
  try {
    const pkg = 'com.android.adbkeyboard'
    const installed = await isInstalled(deviceId, pkg)
    return installed
  }
  catch (error) {
    console.warn(
      `Failed to check AdbKeyboard on device ${deviceId}:`,
      error?.message || error,
    )
    return false
  }
}

export async function installAdbKeyboard(deviceId) {
  try {
    const installed = await isInstalledAdbKeyboard(deviceId)

    if (installed) {
      return true
    }

    await install(deviceId, adbKeyboardApkPath)

    const installedAfter = await isInstalledAdbKeyboard(deviceId)

    if (installedAfter) {
      await deviceShell(deviceId, 'ime enable com.android.adbkeyboard/.AdbIME')
    }

    return installedAfter
  }
  catch (error) {
    const message = `Failed to install AdbKeyboard on device ${deviceId}: ${error?.message || error}`

    console.warn(message)

    throw new Error(message)
  }
}

/**
 * Open a logcat stream for a device
 * @param {string} id - Device ID
 * @param {Object} options
 * @param {boolean} [options.clear] - Clear logcat before opening
 * @param {(entry: { date: Date, pid: number, tid: number, priority: number, tag: string, message: string }) => void} [options.onEntry]
 * @param {() => void} [options.onEnd]
 * @param {(error: Error) => void} [options.onError]
 */
async function openLogcat(id, options = {}) {
  const { clear = false, onEntry = () => {}, onEnd = () => {}, onError = () => {} } = options

  closeLogcat(id)

  const device = client.getDevice(id)
  const reader = await device.openLogcat({ clear })

  logcatReaders.set(id, reader)

  reader.on('entry', entry => onEntry(entry))
  reader.on('end', () => {
    if (logcatReaders.get(id) === reader) {
      logcatReaders.delete(id)
    }
    onEnd()
  })
  reader.on('error', error => onError(error))

  return true
}

function closeLogcat(id) {
  const reader = logcatReaders.get(id)

  if (!reader) {
    return false
  }

  try {
    reader.end()
  }
  catch (error) {
    console.warn(`closeLogcat(${id}) error:`, error?.message || error)
  }
  finally {
    logcatReaders.delete(id)
  }

  return true
}

function closeAllLogcats() {
  for (const id of [...logcatReaders.keys()]) {
    closeLogcat(id)
  }
}

function isLogcatOpen(id) {
  return logcatReaders.has(id)
}

/**
 * List installed packages with apk paths and type classification
 * @param {string} id - Device ID
 * @returns {Promise<{ name: string, apkPath: string, system: boolean, disabled: boolean }[]>}
 */
async function listPackages(id) {
  const [allRaw, userRaw, disabledRaw] = await Promise.all([
    deviceShell(id, 'pm list packages -f'),
    deviceShell(id, 'pm list packages -3'),
    deviceShell(id, 'pm list packages -d'),
  ])

  const userSet = new Set(parsePackageNames(userRaw))
  const disabledSet = new Set(parsePackageNames(disabledRaw))

  return parsePackageList(allRaw).map(item => ({
    ...item,
    system: !userSet.has(item.name),
    disabled: disabledSet.has(item.name),
  }))
}

/**
 * Bulk package info from `dumpsys package`
 * @param {string} id - Device ID
 * @returns {Promise<Record<string, { versionName: string, versionCode: string, firstInstallTime: string, lastUpdateTime: string, installerPackageName: string, permissions: string[] }>>}
 */
async function getPackagesInfo(id) {
  const stdout = await deviceShell(id, 'dumpsys package')
  return parseDumpsysPackages(stdout)
}

/**
 * Get sizes of files in remote directories via `ls -l` (covers split APKs).
 * Split APKs share the package's install directory on modern Android.
 * @param {string} id - Device ID
 * @param {{ name: string, apkPath: string }[]} packages
 * @returns {Promise<Record<string, { size: number | null, splits: { name: string, size: number }[] }>>} keyed by package name
 */
async function getPackagesSizes(id, packages) {
  const metaByPackage = new Map()
  const filesByDir = new Map()
  const unsafePaths = new Set()

  for (const item of packages) {
    const separatorIndex = item.apkPath.lastIndexOf('/')

    if (separatorIndex <= 0) {
      continue
    }

    const dir = item.apkPath.slice(0, separatorIndex)
    const baseName = item.apkPath.slice(separatorIndex + 1)

    // Skip paths that could break out of the quoted shell argument
    if (!isSafeShellArgument(dir) || !isSafeShellArgument(baseName)) {
      console.warn(`getPackagesSizes skipped unsafe path: ${item.apkPath}`)
      unsafePaths.add(item.name)
      continue
    }

    metaByPackage.set(item.name, { dir, baseName })
    filesByDir.set(dir, [])
  }

  const concurrencyLimit = Number(electronStore.get('common.concurrencyLimit') ?? 10)
  const limit = pLimit(concurrencyLimit)

  await Promise.all(
    [...filesByDir.keys()].map(dir =>
      limit(async () => {
        try {
          const stdout = await deviceShell(id, `ls -l '${dir}'`)
          filesByDir.set(dir, parseLsOutput(stdout))
        }
        catch (error) {
          console.warn(`getPackagesSizes ls failed for ${dir}:`, error?.message || error)
          filesByDir.set(dir, [])
        }
      }),
    ),
  )

  const result = {}

  for (const name of unsafePaths) {
    result[name] = { size: null, splits: [] }
  }

  for (const [name, { dir, baseName }] of metaByPackage) {
    const entries = filesByDir.get(dir) || []
    const apkFiles = entries.filter(entry => entry.name.endsWith('.apk'))
    const base = apkFiles.find(entry => entry.name === baseName)
    const splits = apkFiles
      .filter(entry => entry.name !== baseName)
      .map(({ name: splitName, size }) => ({ name: splitName, size }))

    result[name] = {
      size: typeof base?.size === 'number' ? base.size : null,
      splits,
    }
  }

  return result
}

async function enablePackage(id, pkg) {
  assertSafePackageName(pkg)
  return deviceShell(id, `pm enable ${pkg}`)
}

async function disablePackage(id, pkg) {
  assertSafePackageName(pkg)
  return deviceShell(id, `pm disable-user ${pkg}`)
}

async function clearPackage(id, pkg) {
  assertSafePackageName(pkg)
  return deviceShell(id, `pm clear ${pkg}`)
}

/**
 * Uninstall for system apps without root: remove for the current user only
 * @param {string} id - Device ID
 * @param {string} pkg - Package name
 */
async function uninstallSystemForUser(id, pkg) {
  assertSafePackageName(pkg)
  return deviceShell(id, `pm uninstall -k --user 0 ${pkg}`)
}

async function launchPackage(id, pkg) {
  assertSafePackageName(pkg)
  return deviceShell(id, `monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`)
}

export {
  clearPackage,
  closeAllLogcats,
  closeLogcat,
  disablePackage,
  enablePackage,
  getPackagesInfo,
  getPackagesSizes,
  isLogcatOpen,
  launchPackage,
  listPackages,
  openLogcat,
  uninstallSystemForUser,
}

export default {
  shell,
  init,
  getScreenSize,
  getDeviceList,
  deviceShell,
  kill,
  pair,
  connect,
  disconnect,
  getDeviceIP,
  tcpip,
  screencap,
  install,
  uninstall,
  uninstallSystemForUser,
  isInstalled,
  version,
  push,
  pull,
  watch,
  readdir,
  scannerConnect,
  discoverConnect,
  battery,
  uploader,
  downloader,
  waitForDevice,
  getSerialNo,
  killProcesses,
  installAdbKeyboard,
  isInstalledAdbKeyboard,
  openLogcat,
  closeLogcat,
  closeAllLogcats,
  isLogcatOpen,
  listPackages,
  getPackagesInfo,
  getPackagesSizes,
  enablePackage,
  disablePackage,
  clearPackage,
  launchPackage,
}
