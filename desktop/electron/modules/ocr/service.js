import fs from 'node:fs'
import path from 'node:path'
import { app, clipboard, ipcMain } from 'electron'

const workers = new Map()
let quitHooked = false

export const OCR_ALLOWED_LANGS = new Set(['eng', 'chi_sim', 'chi_tra', 'jpn', 'rus', 'ara'])
export const OCR_DEFAULT_LANG = 'eng'

function getLangPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'extra', 'common', 'tesseract')
  }

  return path.join(app.getAppPath(), 'electron', 'resources', 'extra', 'common', 'tesseract')
}

export function sanitizeOcrLang(value) {
  const lang = String(value ?? OCR_DEFAULT_LANG).trim()
  return OCR_ALLOWED_LANGS.has(lang) ? lang : OCR_DEFAULT_LANG
}

function hasTrainedData(lang) {
  try {
    return fs.existsSync(path.join(getLangPath(), `${lang}.traineddata`))
  }
  catch {
    return false
  }
}

/**
 * Lazily create and cache one recognition worker per language.
 * tessdata_fast ships LSTM-only models, hence OEM 1.
 * Missing models fall back to English at call time (no throw).
 */
function getWorker(rawLang) {
  const lang = sanitizeOcrLang(rawLang)
  if (!workers.has(lang)) {
    const promise = (async () => {
      // Bare specifier on purpose: tesseract.js is rollup-externalized and
      // resolved from node_modules at runtime (works with asar: false)
      const { createWorker } = await import(/* @vite-ignore */ 'tesseract.js')

      return createWorker(lang, 1, {
        langPath: getLangPath(),
        gzip: false,
        logger: () => {},
      })
    })()
      .catch((error) => {
        // Allow a retry on the next invocation instead of caching the failure
        workers.delete(lang)
        throw error
      })
    workers.set(lang, promise)
  }

  return workers.get(lang).then(worker => ({ worker, lang }))
}

function stripDataUrl(value) {
  return String(value ?? '').replace(/^data:image\/\w+;base64,/, '')
}

// ~15 MB decoded PNG headroom above any realistic screenshot
const MAX_IMAGE_BASE64_LENGTH = 20 * 1024 * 1024

export function terminateOcrWorker() {
  if (!workers.size) {
    return false
  }

  const promises = [...workers.values()]
  workers.clear()

  for (const promise of promises) {
    promise
      .then(worker => (typeof worker?.terminate === 'function' ? worker.terminate() : worker?.worker?.terminate?.()))
      .catch(error => console.warn('terminateOcrWorker:', error?.message || error))
  }

  return true
}

export function registerOcrService() {
  ipcMain.removeHandler('ocr:recognize')
  ipcMain.handle('ocr:recognize', async (_event, payload = {}) => {
    const encoded = stripDataUrl(payload.imageBase64)

    if (!encoded || encoded.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new Error(`OCR payload rejected: expected a base64 image under ${Math.round(MAX_IMAGE_BASE64_LENGTH / 1024 / 1024)} MB`)
    }

    const requested = sanitizeOcrLang(payload.lang)
    const effective = hasTrainedData(requested) ? requested : OCR_DEFAULT_LANG
    const { worker } = await getWorker(effective)
    const buffer = Buffer.from(encoded, 'base64')

    const { data } = await worker.recognize(buffer)

    return {
      text: data?.text ?? '',
      lang: effective,
      fallback: effective !== requested,
      requested,
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
