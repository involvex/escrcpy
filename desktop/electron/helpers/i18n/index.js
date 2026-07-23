import i18n from 'i18next'
import fs from 'node:fs'
import path from 'node:path'
import osLocale from 'os-locale'
import electronStore from '$electron/helpers/store/index.js'
import { localesDir } from '$electron/configs/extra/index.js'

const lng = electronStore.get('common.language') ?? osLocale() ?? 'en-US'

function loadTranslations(lang) {
  try {
    const filePath = path.join(localesDir, `${lang}.json`)
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return {}
  }
}

const resources = {
  [lng]: { translation: loadTranslations(lng) },
}

if (lng !== 'en-US') {
  resources['en-US'] = { translation: loadTranslations('en-US') }
}

const initPromise = i18n.init({
  lng,
  fallbackLng: 'en-US',
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
  if (i18n.language === val) {
    return
  }

  changeLanguage(val)
})

function changeLanguage(val) {
  const newResources = loadTranslations(val)
  i18n.addResourceBundle(val, 'translation', newResources, true, true)
  i18n.changeLanguage(val)
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