import { ApiModelEnum } from '$copilot/dicts/api.js'
import { isEqual } from 'lodash-es'

export const useCopilotStore = defineStore('app-copilot', () => {
  const defaultConfig = {
    provider: 'BigModel',
    baseUrl: ApiModelEnum.BigModel,
    model: ApiModelEnum.named.BigModel.label,
    apiKey: '',
    maxSteps: 50,
    lang: 'cn',
    quiet: false,
    prompts: [],
  }

  const config = ref({
    ...defaultConfig,
  })

  updateConfig(window.$preload.store.get('copilot') ?? {})

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
