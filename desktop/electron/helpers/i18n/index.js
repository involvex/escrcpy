import i18n from 'i18next'
import fs from 'node:fs'
import path from 'node:path'
import electronStore from '$electron/helpers/store/index.js'
import { localesDir } from '$electron/configs/extra/index.js'

const FALLBACK_LANG = 'en-US'

function listAvailableLanguages() {
  try {
    return fs.readdirSync(localesDir)
      .filter(name => name.endsWith('.json'))
      .map(name => name.replace(/\.json$/i, ''))
  }
  catch {
    return [FALLBACK_LANG]
  }
}

const availableLanguages = listAvailableLanguages()

function resolveLanguage(lang) {
  if (lang && availableLanguages.includes(lang)) {
    return lang
  }
  return FALLBACK_LANG
}

const storedLang = electronStore.get('common.language')
const lng = resolveLanguage(storedLang)

// Migrate unsupported language codes (e.g. legacy `de`) to a real locale file
if (storedLang && storedLang !== lng) {
  electronStore.set('common.language', lng)
}

function loadTranslations(lang) {
  try {
    const filePath = path.join(localesDir, `${lang}.json`)
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }
  catch {
    return {}
  }
}

const resources = {
  [lng]: { translation: loadTranslations(lng) },
}

if (lng !== FALLBACK_LANG) {
  resources[FALLBACK_LANG] = { translation: loadTranslations(FALLBACK_LANG) }
}

const initPromise = i18n.init({
  lng,
  fallbackLng: FALLBACK_LANG,
  resources,
  interpolation: {
    escapeValue: false,
    prefix: '{',
    suffix: '}',
  },
  returnEmptyString: false,
})

export const t = (...args) => i18n.t(...args)

export { initPromise }

electronStore.onDidChange('common.language', (val) => {
  const next = resolveLanguage(val)
  if (val && val !== next) {
    electronStore.set('common.language', next)
    return
  }
  if (i18n.language === next) {
    return
  }

  changeLanguage(next)
})

function changeLanguage(val) {
  const next = resolveLanguage(val)
  const newResources = loadTranslations(next)
  if (!Object.keys(newResources).length && next !== FALLBACK_LANG) {
    return changeLanguage(FALLBACK_LANG)
  }
  i18n.addResourceBundle(next, 'translation', newResources, true, true)
  i18n.changeLanguage(next)
}

function onLanguageChanged(callback) {
  i18n.on('languageChanged', callback)

  return () => {
    i18n.off('languageChanged', callback)
  }
}

function getCurrentLanguage() {
  return i18n.language
}

export default {
  t,
  changeLanguage,
  onLanguageChanged,
  getCurrentLanguage,
}
