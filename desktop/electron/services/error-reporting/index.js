import { app, ipcMain } from 'electron'
import electronStore from '$electron/helpers/store/index.js'

const ENDPOINT = 'https://errors.escrcpy.app/report'

let initialized = false

function redact(input) {
  if (typeof input !== 'string') {
    return input
  }
  return input
    .replace(/\b[0-9a-f]{8}\b/g, '<hex>')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}:\d{1,5}\b/g, '<addr>')
    .replace(/[A-Z0-9]{4,}/g, '<id>')
}

function safePayload(error) {
  return {
    name: error?.name || 'Error',
    message: redact(error?.message || String(error)),
    stack: redact(error?.stack || ''),
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  }
}

async function send(error) {
  if (!electronStore.get('common.errorReporting')) {
    return
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safePayload(error)),
    })
    if (!response.ok) {
      console.warn('[errorReporting] server responded', response.status)
    }
  }
  catch (err) {
    console.warn('[errorReporting] failed to send:', err?.message || err)
  }
}

function init() {
  if (initialized || electronStore.get('common.errorReporting') === false) {
    return
  }
  initialized = true

  process.on('uncaughtException', (error) => {
    console.error('[uncaughtException]', error)
    send(error)
  })

  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason)
    send(reason instanceof Error ? reason : new Error(String(reason)))
  })

  app.on('render-process-gone', (_event, details) => {
    console.error('[render-process-gone]', details.reason)
    send(new Error(`Renderer gone: ${details.reason}`))
  })

  app.on('child-process-gone', (_event, details) => {
    console.error('[child-process-gone]', details.reason)
    send(new Error(`Child process gone: ${details.reason}`))
  })

  ipcMain.handle('errorReporting:report', (_event, error) => {
    if (error) {
      send(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

export default {
  name: 'service:errorReporting',
  apply() {
    init()

    electronStore.onDidChange('common.errorReporting', (val) => {
      if (val === true) {
        init()
      }
    })
  },
}
