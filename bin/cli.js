#!/usr/bin/env node
import {spawn} from 'node:child_process'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

const child = spawn('bun', ['run', 'dev'], {
	cwd: rootDir,
	stdio: 'inherit',
	shell: true,
})

child.on('exit', code => {
	process.exit(code || 0)
})
