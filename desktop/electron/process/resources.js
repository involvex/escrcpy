import { resolve } from 'node:path'
import which from 'which'

export function extraResolve(filePath) {
  const isProduction = import.meta.env.MODE === 'production'

  let basePath
  if (isProduction) {
    basePath = process.resourcesPath
    if (basePath.endsWith('\electron') || basePath.endsWith('/electron')) {
      basePath = basePath.replace(/[/\\]electron$/, '')
    }
  }
  else {
    basePath = 'electron/resources'
  }

  const value = resolve(basePath, 'extra', filePath)

  return value
}

export function buildResolve(value) {
  return resolve(`electron/resources/build/${value}`)
}

/**
 * Resolve a command on PATH.
 * @param {string} command
 * @param {string} [pathEnv] - PATH to search (defaults to process.env.PATH)
 */
export function whichResolve(command, pathEnv = process.env.PATH) {
  return which.sync(command, { nothrow: true, path: pathEnv || process.env.PATH })
}
