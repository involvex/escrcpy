import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRootDir = path.resolve(__dirname, '../..')
const desktopDir = path.resolve(repoRootDir, 'desktop')
const packagesDir = path.resolve(repoRootDir, 'packages')

const autoglmDestDir = path.resolve(desktopDir, 'node_modules', 'autoglm.js')
const adbKeyboardDestDir = path.resolve(desktopDir, 'node_modules', '@autoglm.js', 'adb-keyboard')
const sharedDestDir = path.resolve(desktopDir, 'node_modules', '@autoglm.js', 'shared')

function copyDir(src, dest, visited = new Set()) {
  const srcAbs = path.resolve(src)
  if (visited.has(srcAbs))
    return
  visited.add(srcAbs)

  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(srcAbs, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(srcAbs, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(srcPath)
      const fullTarget = path.resolve(srcAbs, target)
      if (!fs.existsSync(fullTarget)) {
        continue
      }
      const stats = fs.statSync(fullTarget)
      if (stats.isDirectory()) {
        copyDir(fullTarget, destPath, visited)
      }
      else {
        fs.copyFileSync(fullTarget, destPath)
      }
    }
    else if (entry.isDirectory()) {
      copyDir(srcPath, destPath, visited)
    }
    else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

console.log('Copying autoglm.js...')

if (fs.existsSync(autoglmDestDir)) {
  fs.rmSync(autoglmDestDir, { recursive: true })
}

const autoglmSrc = path.join(packagesDir, 'autoglm.js')
copyDir(autoglmSrc, autoglmDestDir)

const adbKeyboardSrc = path.join(packagesDir, 'autoglm.js-adb-keyboard')
if (fs.existsSync(adbKeyboardSrc)) {
  if (fs.existsSync(adbKeyboardDestDir)) {
    fs.rmSync(adbKeyboardDestDir, { recursive: true })
  }
  copyDir(adbKeyboardSrc, adbKeyboardDestDir)
}

const sharedSrc = path.join(packagesDir, 'autoglm.js-shared')
if (fs.existsSync(sharedSrc)) {
  if (fs.existsSync(sharedDestDir)) {
    fs.rmSync(sharedDestDir, { recursive: true })
  }
  copyDir(sharedSrc, sharedDestDir)
}

console.log('Copy complete')
