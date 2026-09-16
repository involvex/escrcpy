import { ApiModelEnum } from '$copilot/dicts/api.js'
import { isEqual } from 'lodash-es'

const DEFAULT_PROMPTS = [
  'Open Settings',
  'Go to the home screen',
  'Take a screenshot and describe what you see',
  'shell pm list packages -3',
  'Open the recent apps overview',
]

export const useCopilotStore = defineStore('app-copilot', () => {
  const defaultConfig = {
    provider: 'BigModel',
    baseUrl: ApiModelEnum.BigModel,
    model: ApiModelEnum.named.BigModel.label,
    apiKey: '',
    maxSteps: 50,
    lang: 'en',
    quiet: false,
    prompts: [...DEFAULT_PROMPTS],
  }

  const config = ref({
    ...defaultConfig,
  })

  const stored = window.$preload.store.get('copilot') ?? {}
  updateConfig({
    ...stored,
    // Seed default presets when the user has never configured prompts
    prompts: Array.isArray(stored.prompts) && stored.prompts.length
      ? stored.prompts
      : [...DEFAULT_PROMPTS],
  })

  window.$preload.store.onDidChange('copilot', (val) => {
    if (isEqual(val, config.value)) {
      return false
    }

    updateConfig(val)
  })

  function updateConfig(val = {}) {
    config.value = {
      ...toRaw(config.value),
      ...val,
    }

    window.$preload.store.set('copilot', toRaw(config.value))
  }

  function resetConfig(options = {}) {
    if (options.source === 'store') {
      updateConfig(window.$preload.store.get('copilot') ?? defaultConfig)
      return
    }

    updateConfig(defaultConfig)
  }

  return {
    defaultConfig,
    config,
    updateConfig,
    resetConfig,
  }
})
