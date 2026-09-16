<template>
  <el-dialog
    v-model="dialog.visible" :title="$t('copilot.config.title')" destroy-on-close append-to-body fullscreen
    center class="el-dialog--beautify el-dialog--flex el-dialog--fullscreen config-dialog" :close-on-click-modal="false"
    @open="onOpen" @close="onClose"
  >
    <div class="h-full overflow-y-auto pr-2 pt-2">
      <el-form ref="configFormRef" :model="configForm" :rules="formRules" label-width="100px" class="config-form">
        <div class="space-y-4">
          <el-card :header="$t('copilot.config.apiSection')" class="el-card--beautify" shadow="never">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item prop="provider" :label="$t('copilot.config.provider')">
                  <el-select
                    v-model="configForm.provider" :placeholder="$t('copilot.config.providerPlaceholder')"
                    allow-create filterable class="w-full" @change="onProviderChange"
                  >
                    <el-option v-for="item of providerOptions" :key="item" :label="item" :value="item">
                    </el-option>
                  </el-select>
                </el-form-item>
              </el-col>

              <el-col :span="12">
                <el-form-item prop="model" :label="$t('copilot.config.model')">
                  <div class="flex w-full gap-2">
                    <el-select
                      v-model="configForm.model" :placeholder="$t('copilot.config.modelPlaceholder')"
                      allow-create filterable class="flex-1 min-w-0"
                      :loading="modelsLoading"
                    >
                      <el-option v-for="item of modelOptions" :key="item" :label="item" :value="item">
                      </el-option>
                    </el-select>
                    <el-button
                      :loading="modelsLoading"
                      :title="$t('copilot.config.refreshModels') || 'Refresh models'"
                      @click="fetchModels"
                    >
                      <el-icon><Refresh /></el-icon>
                    </el-button>
                  </div>
                </el-form-item>
              </el-col>

              <el-col :span="24">
                <el-form-item prop="baseUrl" :label="$t('copilot.config.baseUrl')">
                  <el-input
                    v-model="configForm.baseUrl" :placeholder="$t('copilot.config.baseUrlPlaceholder')"
                    clearable class="config-input"
                  />
                </el-form-item>
              </el-col>

              <el-col :span="24">
                <el-form-item prop="apiKey" :label="$t('copilot.config.apiKey')">
                  <el-input
                    v-model="configForm.apiKey" :type="showApiKey ? 'text' : 'password'"
                    :placeholder="$t('copilot.config.apiKeyPlaceholder')" clearable class="config-input"
                  >
                    <template #suffix>
                      <el-button text @click="showApiKey = !showApiKey">
                        <el-icon>
                          <View v-if="showApiKey" />
                          <Hide v-else />
                        </el-icon>
                      </el-button>
                    </template>
                  </el-input>
                </el-form-item>
              </el-col>
            </el-row>
          </el-card>

          <el-card :header="$t('copilot.config.executionSection')" class="el-card--beautify" shadow="never">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item prop="lang" :label="$t('copilot.config.lang')" class="">
                  <el-radio-group v-model="configForm.lang" class="">
                    <el-radio-button value="cn">
                      {{ $t('copilot.config.langCn') }}
                    </el-radio-button>
                    <el-radio-button value="en">
                      {{ $t('copilot.config.langEn') }}
                    </el-radio-button>
                    <el-radio-button value="fr">
                      Français
                    </el-radio-button>
                  </el-radio-group>
                </el-form-item>
              </el-col>
              <!-- <el-col :span="12">
                <el-form-item
                  prop="quiet"
                  :label="$t('copilot.config.quiet')"
                >
                  <el-switch v-model="configForm.quiet" />
                </el-form-item>
              </el-col> -->
            </el-row>

            <el-form-item prop="maxSteps" :label="$t('copilot.config.maxSteps')">
              <div class="mb-6 flex items-center justify-between w-full">
                <div class="flex-none font-semibold text-base text-primary-500">
                  {{ configForm.maxSteps }}
                </div>

                <div class="flex-1 min-w-0 px-4">
                  <el-slider v-model="configForm.maxSteps" :min="1" :max="100" :step="1" class="" show-input />
                </div>
              </div>
            </el-form-item>
          </el-card>
        </div>
      </el-form>
    </div>

    <template #footer>
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <el-button @click="onResetClick">
            <el-icon class="mr-1">
              <RefreshRight />
            </el-icon>
            {{ $t('copilot.config.reset') }}
          </el-button>
        </div>

        <div class="flex items-center">
          <el-button @click="onCloseClick">
            {{ $t('common.cancel') }}
          </el-button>
          <el-button type="primary" @click="onSaveClick">
            <el-icon class="mr-1">
              <Check />
            </el-icon>
            {{ $t('common.save') }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ApiModelEnum } from '$copilot/dicts/api.js'
import copilotClient from '$copilot/services/index.js'

const props = defineProps({})

const emit = defineEmits([])

const copilotStore = useCopilotStore()

const dialog = useDialog()

const showApiKey = ref(false)
const modelsLoading = ref(false)
const remoteModels = ref([])

const configFormRef = ref(null)

const configForm = computed({
  get() {
    return copilotStore.config
  },
  set(value) {
    copilotStore.config = value
  },
})

const formRules = reactive({
  baseUrl: [
    {
      pattern: /^https?:\/\/.+/,
      message: t('copilot.config.baseUrlInvalid'),
      trigger: 'blur',
    },
  ],
  maxSteps: [
    {
      type: 'number',
      min: 1,
      max: 100,
      message:
        t('copilot.config.maxStepsRange') || 'Steps must be between 1 and 100',
      trigger: 'change',
    },
  ],
})

const providerDefaultModel = computed(() => {
  const provider = configForm.value.provider
  return ApiModelEnum.named[provider]?.label || ''
})

const modelOptions = computed(() => {
  const defaults = providerDefaultModel.value ? [providerDefaultModel.value] : []
  return [...new Set([...remoteModels.value, ...defaults, configForm.value.model].filter(Boolean))]
})

const providerOptions = computed(() => {
  return ApiModelEnum.keys
})

async function fetchModels() {
  const { baseUrl, apiKey } = configForm.value
  if (!baseUrl) {
    return
  }

  modelsLoading.value = true
  try {
    const result = await copilotClient.listModels({ baseUrl, apiKey })
    if (result?.success && Array.isArray(result.models)) {
      remoteModels.value = result.models
      if (result.models.length && !result.models.includes(configForm.value.model)) {
        // Keep current model if custom; otherwise prefer provider default if listed
        const preferred = providerDefaultModel.value
        if (preferred && result.models.includes(preferred)) {
          configForm.value.model = preferred
        }
      }
    }
    else if (result?.message) {
      ElMessage.warning(result.message)
    }
  }
  catch (error) {
    console.warn('[copilot] listModels failed:', error?.message || error)
  }
  finally {
    modelsLoading.value = false
  }
}

async function onProviderChange(val) {
  configForm.value.model = ApiModelEnum.named[val].label
  configForm.value.baseUrl = ApiModelEnum[val]
  remoteModels.value = []
  await fetchModels()
}

async function onOpen() {
  remoteModels.value = []
  await fetchModels()
}

function onClose() {
  handleClearValidate()

  copilotStore.resetConfig({
    source: 'store',
  })
}

async function onSaveClick() {
  try {
    const valid = await configFormRef.value.validate()
    if (!valid)
      return

    copilotStore.updateConfig()

    dialog.close()
  }
  catch (error) {
    if (error.name !== 'ValidationError') {
      console.error('Config save failed:', error)
      ElMessage.error(t('copilot.config.saveFailed'))
    }
  }
}

async function onResetClick() {
  try {
    await ElMessageBox.confirm(
      t('copilot.config.resetConfirm'),
      t('common.tips'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      },
    )
  }
  catch {
    return false
  }

  copilotStore.resetConfig()
  remoteModels.value = []

  handleClearValidate()

  ElMessage.success(t('common.success'))
}

function handleClearValidate() {
  if (configFormRef.value) {
    configFormRef.value.clearValidate()
  }
}

function onCloseClick() {
  dialog.close()
}

defineExpose({
  ...dialog,
})
</script>

<style></style>
