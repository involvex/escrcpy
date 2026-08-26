import path from 'node:path'
import { app, clipboard, ipcMain } from 'electron'

let workerPromise = null
let quitHooked = false

function getLangPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'extra', 'common', 'tesseract')
  }

  return path.join(app.getAppPath(), 'electron', 'resources', 'extra', 'common', 'tesseract')
}

/**
 * Lazily create and cache the recognition worker.
 * tessdata_fast ships LSTM-only models, hence OEM 1.
 */
function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      // Bare specifier on purpose: tesseract.js is rollup-externalized and
      // resolved from node_modules at runtime (works with asar: false)
      const { createWorker } = await import(/* @vite-ignore */ 'tesseract.js')

      return createWorker('eng', 1, {
        langPath: getLangPath(),
        gzip: false,
        logger: () => {},
      })
    })()
      .catch((error) => {
        // Allow a retry on the next invocation instead of caching the failure
        workerPromise = null
        throw error
      })
  }

  return workerPromise
}

function stripDataUrl(value) {
  return String(value ?? '').replace(/^data:image\/\w+;base64,/, '')
}

// ~15 MB decoded PNG headroom above any realistic screenshot
const MAX_IMAGE_BASE64_LENGTH = 20 * 1024 * 1024

export function terminateOcrWorker() {
  if (!workerPromise) {
    return false
  }

  const promise = workerPromise
  workerPromise = null

  promise
    .then(worker => worker.terminate())
    .catch(error => console.warn('terminateOcrWorker:', error?.message || error))

  return true
}

export function registerOcrService() {
  ipcMain.removeHandler('ocr:recognize')
  ipcMain.handle('ocr:recognize', async (_event, payload = {}) => {
    const encoded = stripDataUrl(payload.imageBase64)

    if (!encoded || encoded.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new Error(`OCR payload rejected: expected a base64 image under ${Math.round(MAX_IMAGE_BASE64_LENGTH / 1024 / 1024)} MB`)
    }

    const worker = await getWorker()
    const buffer = Buffer.from(encoded, 'base64')

    const { data } = await worker.recognize(buffer)

    return {
      text: data?.text ?? '',
    }
  })

  ipcMain.removeHandler('copy-text-to-clipboard')
  ipcMain.handle('copy-text-to-clipboard', (_event, text) => {
    clipboard.writeText(String(text ?? ''))
    return true
  })

  if (!quitHooked) {
    quitHooked = true
    app.on('will-quit', () => {
      terminateOcrWorker()
    })
  }
}
