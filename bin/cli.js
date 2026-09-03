#!/usr/bin/env node
import {spawn, spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import fs from 'node:fs'

import {
	buildAdbArgs,
	buildScrcpyArgs,
	buildScrcpyRecordArgs,
	parseAdbDevices,
	parseCliArgs,
} from '../desktop/src/utils/cli/index.js'
import {
	assertSafeSerial,
	assertSafeShellArgument,
	sanitizeFilePath,
} from '../desktop/electron/helpers/shell/safe-args.js'
import {basename} from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

const require = createRequire(import.meta.url)
const {version: CLI_VERSION} = require('../package.json')

const USAGE = `escrcpy - headless companion for the escrcpy desktop app

Usage:
  escrcpy                       launch the desktop app (same as: escrcpy dev)
  escrcpy dev                   launch the desktop app in development mode
  escrcpy devices [--json]      list connected adb devices
  escrcpy mirror <serial> [scrcpy args...]
                                start a scrcpy mirror for one device
  escrcpy record <serial> -o out.mp4 [scrcpy args...]
                                mirror and record to an mp4 file
  escrcpy shot <serial> [-o out.png]
                                capture a screenshot to a png file
  escrcpy install <serial> <apk>
                                install an apk onto a device
  escrcpy shell <serial> [--] <cmd...>
                                run a shell command on a device
  escrcpy push <serial> <local> [remote]
                                push a file (default remote: /sdcard/Download/)
  escrcpy pull <serial> <remote> [local]
                                pull a file from a device
  escrcpy connect <host[:port]> connect a wireless device
  escrcpy disconnect <host[:port]>
                                disconnect a wireless device
  escrcpy battery <serial> [--json]
                                dump battery state (dumpsys battery)
  escrcpy logcat <serial> [--dump] [--clear] [-o out.txt]
                                stream (-d dumps once) device logs

Options:
  --adb <path>                  path to the adb binary (default: PATH)
  --scrcpy <path>               path to the scrcpy binary (default: PATH)
  --timeout <ms>                abort one-shot adb commands after ms
  --wait-for-device             wait until the device is online first
  -h, --help                    show this help  (wins from any position)
  -v, --version                 show version    (wins from any position)

Environment:
  ESCRCPY_ADB                   fallback path for adb
  ESCRCPY_SCRCPY                fallback path for scrcpy
`

function resolveBinary(flagPath, envName, fallbackName) {
	return flagPath || process.env[envName] || fallbackName
}

function run(binary, args, options = {}) {
	const {timeoutMs, ...spawnOptions} = options
	const timeout = Number(timeoutMs) > 0 ? Number(timeoutMs) : undefined
	const result = spawnSync(binary, args, {
		encoding: 'buffer',
		...(timeout ? {timeout} : {}),
		...spawnOptions,
	})

	if (result.error) {
		console.error(`Failed to run "${binary}": ${result.error.message}`)
		process.exit(1)
	}

	return result
}

function maybeWaitForDevice(parsed) {
	if (!parsed.waitForDevice || !parsed.serial) {
		return
	}
	assertSafeSerial(parsed.serial)
	const result = run(
		resolveBinary(parsed.adbPath, 'ESCRCPY_ADB', 'adb'),
		buildAdbArgs('wait-for-device', parsed.serial),
		{
			stdio: 'inherit',
			timeoutMs: parsed.timeoutMs,
		},
	)
	if (result.status !== 0) {
		console.error('Device did not come online in time')
		process.exit(result.status || 1)
	}
}

function ensureParentDir(filePath) {
	const outDir = dirname(filePath)
	if (outDir && outDir !== '.') {
		fs.mkdirSync(outDir, {recursive: true})
	}
}

function printDevices(parsed) {
	const result = run(
		resolveBinary(parsed.adbPath, 'ESCRCPY_ADB', 'adb'),
		['devices', '-l'],
		{
			stdio: ['ignore', 'pipe', 'pipe'],
		},
	)

	const output = result.stdout.toString()

	if (parsed.json) {
		console.log(JSON.stringify(parseAdbDevices(output), null, 2))
		return
	}

	process.stdout.write(output)
}

function startMirror(parsed, {record = false} = {}) {
	assertSafeSerial(parsed.serial)

	const binary = resolveBinary(parsed.scrcpyPath, 'ESCRCPY_SCRCPY', 'scrcpy')
	const scrcpyArgs = record
		? buildScrcpyRecordArgs(
				parsed.serial,
				sanitizeFilePath(parsed.out),
				parsed.scrcpyArgs,
			)
		: buildScrcpyArgs(parsed.serial, parsed.scrcpyArgs)
	if (record) {
		ensureParentDir(parsed.out)
	}
	const child = spawn(binary, scrcpyArgs, {stdio: 'inherit'})

	child.on('exit', code => process.exit(code || 0))
}

function runShell(parsed) {
	assertSafeSerial(parsed.serial)
	maybeWaitForDevice(parsed)
	for (const part of parsed.shellCmd) {
		assertSafeShellArgument(part, 'shell token')
	}

	const result = run(
		resolveBinary(parsed.adbPath, 'ESCRCPY_ADB', 'adb'),
		buildAdbArgs('shell', parsed.serial, undefined, {
			shellCmd: parsed.shellCmd,
		}),
		{stdio: 'inherit', timeoutMs: parsed.timeoutMs},
	)
	process.exit(result.status || 0)
}

function pushFile(parsed) {
	assertSafeSerial(parsed.serial)
	maybeWaitForDevice(parsed)

	const result = run(
		resolveBinary(parsed.adbPath, 'ESCRCPY_ADB', 'adb'),
		buildAdbArgs('push', parsed.serial, undefined, {
			local: parsed.local,
			remote: parsed.remote,
		}),
		{stdio: 'inherit', timeoutMs: parsed.timeoutMs},
	)
	process.exit(result.status || 0)
}

function pullFile(parsed) {
	assertSafeSerial(parsed.serial)
	maybeWaitForDevice(parsed)
	const local = parsed.local || `./${basename(parsed.remote)}`
	ensureParentDir(local)

	const result = run(
		resolveBinary(parsed.adbPath, 'ESCRCPY_ADB', 'adb'),
		buildAdbArgs('pull', parsed.serial, undefined, {
			remote: parsed.remote,
			local,
		}),
		{stdio: 'inherit', timeoutMs: parsed.timeoutMs},
	)
	if (result.status === 0) {
		console.log(`Saved to ${local}`)
	}
	process.exit(result.status || 0)
}

function connectDevice(parsed) {
	assertSafeShellArgument(parsed.host, 'host')

	const result = run(
		resolveBinary(parsed.adbPath, 'ESCRCPY_ADB', 'adb'),
		buildAdbArgs('connect', parsed.host),
		{stdio: 'inherit', timeoutMs: parsed.timeoutMs},
	)
	process.exit(result.status || 0)
}

function disconnectDevice(parsed) {
	assertSafeShellArgument(parsed.host, 'host')

	const result = run(
		resolveBinary(parsed.adbPath, 'ESCRCPY_ADB', 'adb'),
		buildAdbArgs('disconnect', parsed.host),
		{stdio: 'inherit', timeoutMs: parsed.timeoutMs},
	)
	process.exit(result.status || 0)
}

function dumpBattery(parsed) {
	assertSafeSerial(parsed.serial)
	maybeWaitForDevice(parsed)

	const result = run(
		resolveBinary(parsed.adbPath, 'ESCRCPY_ADB', 'adb'),
		buildAdbArgs('battery', parsed.serial),
		{stdio: ['ignore', 'pipe', 'pipe'], timeoutMs: parsed.timeoutMs},
	)
	if (result.status !== 0) {
		console.error(result.stderr.toString() || 'Battery dump failed')
		process.exit(result.status || 1)
	}
	if (parsed.json) {
		console.log(
			JSON.stringify(
				{serial: parsed.serial, output: result.stdout.toString()},
				null,
				2,
			),
		)
		return
	}
	process.stdout.write(result.stdout)
}

function tailLogcat(parsed) {
	assertSafeSerial(parsed.serial)

	const binary = resolveBinary(parsed.adbPath, 'ESCRCPY_ADB', 'adb')
	if (parsed.clear) {
		const cleared = run(binary, buildAdbArgs('logcat-clear', parsed.serial), {
			stdio: 'inherit',
			timeoutMs: parsed.timeoutMs,
		})
		if (cleared.status !== 0) {
			process.exit(cleared.status || 1)
		}
	}
	const child = spawn(
		binary,
		buildAdbArgs('logcat', parsed.serial, undefined, {dump: parsed.dump}),
		{stdio: parsed.out ? ['ignore', 'pipe', 'inherit'] : 'inherit'},
	)
	if (parsed.out) {
		ensureParentDir(parsed.out)
		const out = fs.createWriteStream(parsed.out)
		child.stdout.pipe(out)
		child.on('exit', code => process.exit(code || 0))
		return
	}
	child.on('exit', code => process.exit(code || 0))
}

function captureScreenshot(parsed) {
	assertSafeSerial(parsed.serial)
	maybeWaitForDevice(parsed)

	const result = run(
		resolveBinary(parsed.adbPath, 'ESCRCPY_ADB', 'adb'),
		buildAdbArgs('shot', parsed.serial),
		{
			stdio: ['ignore', 'pipe', 'pipe'],
		},
	)

	if (result.status !== 0) {
		console.error(result.stderr.toString() || 'Screenshot capture failed')
		process.exit(result.status || 1)
	}

	ensureParentDir(parsed.out)

	fs.writeFileSync(parsed.out, result.stdout)
	console.log(`Saved screenshot to ${parsed.out}`)
}

function installApk(parsed) {
	assertSafeSerial(parsed.serial)
	maybeWaitForDevice(parsed)

	const result = run(
		resolveBinary(parsed.adbPath, 'ESCRCPY_ADB', 'adb'),
		buildAdbArgs('install', parsed.serial, parsed.apk),
		{
			stdio: 'inherit',
		},
	)

	process.exit(result.status || 0)
}

function launchDevApp() {
	const child = spawn('bun', ['run', 'dev'], {
		cwd: rootDir,
		stdio: 'inherit',
		shell: true,
	})

	child.on('exit', code => process.exit(code || 0))
}

const argv = process.argv.slice(2)
const firstArg = argv[0]

if (!firstArg || firstArg === 'dev') {
	launchDevApp()
} else {
	const parsed = parseCliArgs(argv)

	if (parsed.error) {
		console.error(`Error: ${parsed.error}\n`)
		console.error(USAGE)
		process.exit(1)
	}

	switch (parsed.command) {
		case 'help':
			console.log(USAGE)
			break
		case 'version':
			console.log(`escrcpy-cli ${CLI_VERSION}`)
			break
		case 'devices':
			printDevices(parsed)
			break
		case 'mirror':
			startMirror(parsed)
			break
		case 'record':
			startMirror(parsed, {record: true})
			break
		case 'shot':
			captureScreenshot(parsed)
			break
		case 'install':
			installApk(parsed)
			break
		case 'shell':
			runShell(parsed)
			break
		case 'push':
			pushFile(parsed)
			break
		case 'pull':
			pullFile(parsed)
			break
		case 'connect':
			connectDevice(parsed)
			break
		case 'disconnect':
			disconnectDevice(parsed)
			break
		case 'battery':
			dumpBattery(parsed)
			break
		case 'logcat':
			tailLogcat(parsed)
			break
	}
}
