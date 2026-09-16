import { cloneDeep, get, set } from 'lodash-es'
import {
  getDefaultData,
  getScrcpyExcludeKeys,
  getStoreData,
  mergeConfig,
  setStoreData,
} from './helpers/index.js'
import preferenceModel from '$/models/preference/index.js'
import command from '$/utils/command/index.js'

export const usePreferenceStore = defineStore('app-preference', () => {
  const deviceScope = ref(window.$preload.store.get('scrcpy.deviceScope') || 'global')
  const recordKeys = ref(Object.values(preferenceModel?.record?.children || {}).map((item) => {
    return item.field
  }))
  const cameraKeys = ref(Object.values(preferenceModel?.camera?.children || {}).map((item) => {
    return item.field
  }))
  const otgKeys = ref(['--otg', '--mouse=aoa', '--keyboard=aoa'])

  const launchKeys = ref(Object.values(preferenceModel?.launch?.children || {}).map((item) => {
    return item.field
  }))

  const model = ref(cloneDeep(preferenceModel))
  const data = ref({ ...getDefaultData() })
  const scrcpyExcludeKeys = ref(getScrcpyExcludeKeys())
  const titleBarHeight = ref(0)

  window.$preload.ipcRenderer.invoke('get-primary-display').then((display) => {
    titleBarHeight.value = display.titleBarHeight
  })

  function init(scope = deviceScope.value) {
    data.value = getData(scope)
    scrubInvalidPrefs()
    return data.value
  }

  /** Remove coerced InputNumber junk (e.g. --screen-off-timeout=0) from live + stored prefs. */
  function scrubInvalidPrefs() {
    const timeout = data.value?.['--screen-off-timeout']
    if (timeout != null && Number(timeout) < 1) {
      data.value['--screen-off-timeout'] = undefined
      const scrcpyRoot = window.$preload.store.get('scrcpy') || {}
      for (const [scopeKey, scopeData] of Object.entries(scrcpyRoot)) {
        if (!scopeData || typeof scopeData !== 'object' || Array.isArray(scopeData)) {
          continue
        }
        if (scopeData['--screen-off-timeout'] != null && Number(scopeData['--screen-off-timeout']) < 1) {
          const next = { ...scopeData }
          delete next['--screen-off-timeout']
          window.$preload.store.set(['scrcpy', scopeKey], next)
        }
      }
    }
  }

  function setScope(value) {
    deviceScope.value = value
    window.$preload.store.set('scrcpy.deviceScope', deviceScope.value)
    init()
  }

  function setData(dataToSet, scope = deviceScope.value) {
    setStoreData(dataToSet, scope)
  }

  function reset(scope) {
    if (!scope || ['global'].includes(scope)) {
      window.$preload.store.clear()
    }
    else {
      // Device-scope reset only clears that device's scrcpy overrides.
      // Never wipe shared `common` prefs (language, controlBarOnMirror, paths, hotkeys).
      deviceScope.value = scope
      window.$preload.store.set(['scrcpy', scope], {})
    }
    init()
  }

  function resetDeps(type) {
    switch (type) {
      case 'adb':
        window.$preload.store.set('common.adbPath', '')
        break
      case 'scrcpy':
        window.$preload.store.set('common.scrcpyPath', '')
        break
      default:
        window.$preload.store.set('common.adbPath', '')
        window.$preload.store.set('common.scrcpyPath', '')
        break
    }
    init()
  }

  function getData(scope = deviceScope.value) {
    let value = mergeConfig(getDefaultData(), getStoreData())
    if (scope !== 'global') {
      value = mergeConfig(value, getStoreData(scope))
    }
    return value
  }

  function scrcpyParameter(scope = deviceScope.value, options) {
    const {
      useRecord = false,
      useCamera = false,
      useOtg = false,
      useLaunch = false,
      excludes = [],
      presetArgs = null,
    } = options || {}

    const dataToUse = typeof scope === 'object' ? scope : getData(scope)
    if (!dataToUse) {
      return ''
    }

    const params = Object.entries(dataToUse).reduce((obj, [key, value]) => {
      // 0 from cleared InputNumber must not become --screen-off-timeout=0
      if (key === '--screen-off-timeout' && (!value || value < 1)) {
        return obj
      }

      const shouldExclude
        = (!value && typeof value !== 'number')
          || scrcpyExcludeKeys.value.includes(key)
          || [key, `${key}=${value}`].some(v => excludes.includes(v))
          || (!useRecord && recordKeys.value.includes(key))
          || (!useCamera && cameraKeys.value.includes(key))
          || (!useOtg && [key, `${key}=${value}`].some(v => otgKeys.value.includes(v)))
          || (!useLaunch && launchKeys.value.includes(key))

      if (!shouldExclude) {
        obj[key] = value
      }

      // Handle special case for window-y
      if (key === '--window-y' && typeof value !== 'undefined') {
        obj[key] = Number(value) + titleBarHeight.value
      }

      return obj
    }, {})

    if (params['--flex-display']) {
      delete params['--window-width']
      delete params['--window-height']
    }

    const mergedParams = presetArgs
      ? { ...params, ...presetArgs }
      : params

    let value = command.stringify(mergedParams)
    if (dataToUse.scrcpyAppend) {
      value += ` ${dataToUse.scrcpyAppend}`
    }

    return value
  }

  function getModel(path) {
    return get(model.value, path)
  }

  function setModel(path, value) {
    set(model.value, path, value)
    return model.value
  }

  function resetModel(path) {
    if (!path) {
      model.value = cloneDeep(preferenceModel)
      return true
    }
    set(model.value, path, cloneDeep(get(preferenceModel, path)))
    return true
  }

  init()

  return {
    model,
    data,
    deviceScope,
    scrcpyExcludeKeys,
    recordKeys,
    cameraKeys,
    otgKeys,
    getDefaultData,
    init,
    setScope,
    setData,
    reset,
    resetDeps,
    getData,
    scrcpyParameter,
    getModel,
    setModel,
    resetModel,
  }
})
