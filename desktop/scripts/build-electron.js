import { spawnSync } from 'node:child_process'
import process from 'node:process'

const args = process.argv.slice(2)
const platform = args.find(arg => arg === '--win' || arg === '--mac' || arg === '--linux')

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: true,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

if (platform === '--mac' || platform === '--linux') {
  run('electron-builder', [
    '--config=./electron-builder.config.js',
    '--publish=never',
    platform,
  ])
  process.exit(0)
}

run('electron-builder', [
  '--config=./electron-builder-alt.config.js',
  '--publish=never',
  '--win',
  'dir',
])
run('node', ['scripts/patch-autoglm-asar.js', 'dist-release'])
run('electron-builder', [
  '--config=./electron-builder-noinstall.config.js',
  '--publish=never',
  '--win',
  'portable',
  '--x64',
  '--prepackaged',
  'dist-release/win-unpacked',
])
