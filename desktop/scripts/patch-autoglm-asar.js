import fs from 'node:fs'
import path from 'node:path'

const projectDir = process.cwd()
const distDir = process.argv[2] || 'dist-release-new'
const appDir = path.join(projectDir, distDir, 'win-unpacked', 'resources', 'app')
const packagesDir = path.join(projectDir, '..', 'packages')

function copyPackageContents(src, dest, excludeDirs = ['node_modules']) {
  if (!fs.existsSync(src)) {
    return false
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    if (excludeDirs.includes(entry.name)) {
      continue
    }

    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyPackageContents(srcPath, destPath, excludeDirs)
    }
    else {
      fs.copyFileSync(srcPath, destPath)
    }
  }

  return true
}

console.log('Patching app with autoglm.js...')
console.log('appDir:', appDir)
console.log('packagesDir:', packagesDir)

const autoglmSrc = path.join(packagesDir, 'autoglm.js')
const autoglmDest = path.join(appDir, 'node_modules', 'autoglm.js')
console.log('Copying autoglm.js from:', autoglmSrc)
if (copyPackageContents(autoglmSrc, autoglmDest)) {
  console.log('Copied autoglm.js successfully')
}
else {
  console.error('autoglm.js source not found!')
}

const adbKeyboardSrc = path.join(packagesDir, 'autoglm.js-adb-keyboard')
const adbKeyboardDest = path.join(appDir, 'node_modules', '@autoglm.js', 'adb-keyboard')
const adbKeyboardDir = path.join(appDir, 'node_modules', '@autoglm.js')
if (!fs.existsSync(adbKeyboardDir)) {
  fs.mkdirSync(adbKeyboardDir, { recursive: true })
}
if (copyPackageContents(adbKeyboardSrc, adbKeyboardDest)) {
  console.log('Copied adb-keyboard')
}

const sharedSrc = path.join(packagesDir, 'autoglm.js-shared')
const sharedDest = path.join(appDir, 'node_modules', '@autoglm.js', 'shared')
if (copyPackageContents(sharedSrc, sharedDest)) {
  console.log('Copied shared')
}

console.log('Patch complete (no asar repacking needed)')