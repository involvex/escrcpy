#!/usr/bin/env node
import {spawn, spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import fs from 'node:fs'

import {
	buildAdbArgs,
	buildScrcpyArgs,
	parseAdbDevices,
	parseCliArgs,
} from '../desktop/src/utils/cli/index.js'
import {assertSafeSerial} from '../desktop/electron/helpers/shell/safe-args.js'

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
  escrcpy shot <serial> [-o out.png]
                                capture a screenshot to a png file
  escrcpy install <serial> <apk>
                                install an apk onto a device

Options:
  --adb <path>                  path to the adb binary (default: PATH)
  --scrcpy <path>               path to the scrcpy binary (default: PATH)
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
	const result = spawnSync(binary, args, {
		encoding: 'buffer',
		...options,
	})

	if (result.error) {
		console.error(`Failed to run "${binary}": ${result.error.message}`)
		process.exit(1)
	}

	return result
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

function startMirror(parsed) {
	assertSafeSerial(parsed.serial)

	const binary = resolveBinary(parsed.scrcpyPath, 'ESCRCPY_SCRCPY', 'scrcpy')
	const child = spawn(
		binary,
		buildScrcpyArgs(parsed.serial, parsed.scrcpyArgs),
		{
			stdio: 'inherit',
		},
	)

	child.on('exit', code => process.exit(code || 0))
}

function captureScreenshot(parsed) {
	assertSafeSerial(parsed.serial)

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

	const outDir = dirname(parsed.out)

	if (outDir && outDir !== '.') {
		fs.mkdirSync(outDir, {recursive: true})
	}

	fs.writeFileSync(parsed.out, result.stdout)
	console.log(`Saved screenshot to ${parsed.out}`)
}

function installApk(parsed) {
	assertSafeSerial(parsed.serial)

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
		case 'shot':
			captureScreenshot(parsed)
			break
		case 'install':
			installApk(parsed)
			break
	}
}
