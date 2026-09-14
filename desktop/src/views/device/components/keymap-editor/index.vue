<template>
  <div class="h-full flex flex-col">
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <h2 class="text-lg font-medium">
          {{ $t('keymap.editor.title') }}
        </h2>
        <el-tag v-if="currentDevice" size="small" type="info">
          {{ deviceStore.getLabel(currentDevice, ({ deviceName }) => deviceName) }}
        </el-tag>
      </div>

      <div class="flex items-center gap-2">
        <el-button
          size="small"
          :loading="capturing"
          :disabled="!currentDevice || capturing"
          @click="doCaptureScreenshot"
        >
          <el-icon><CameraFilled /></el-icon>
          {{ $t('keymap.editor.capture') }}
        </el-button>

        <el-button size="small" type="primary" :disabled="!currentDevice" @click="saveProfile">
          {{ $t('keymap.editor.binding.save') }}
        </el-button>
      </div>
    </div>

    <!-- Profile Selector -->
    <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <el-select
          v-model="activeProfileId"
          placeholder="{{ $t('preferences.keymap.activeProfile.placeholder') }}"
          style="width: 240px;"
          size="small"
          @change="onProfileChange"
        >
          <el-option
            v-for="profile in profiles"
            :key="profile.id"
            :label="profile.name || $t('keymap.editor.profile.new')"
            :value="profile.id"
          />
        </el-select>

        <el-button size="small" @click="addProfile">
          <el-icon><Plus /></el-icon>
          {{ $t('keymap.editor.profile.new') }}
        </el-button>

        <el-dropdown v-if="activeProfileId" size="small">
          <el-button>
            <el-icon><MoreFilled /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="duplicateProfile(activeProfileId)">
                <el-icon><DocumentCopy /></el-icon>
                {{ $t('keymap.editor.profile.duplicate') }}
              </el-dropdown-item>
              <el-dropdown-item divided @click="exportProfile(activeProfileId)">
                <el-icon><Download /></el-icon>
                {{ $t('keymap.editor.profile.export') }}
              </el-dropdown-item>
              <el-dropdown-item divided class="text-red-500" @click="deleteProfile(activeProfileId)">
                <el-icon><Delete /></el-icon>
                {{ $t('keymap.editor.profile.delete') }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-button size="small" @click="importProfile">
          <el-icon><UploadFilled /></el-icon>
          {{ $t('keymap.editor.profile.import') }}
        </el-button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Canvas Area -->
      <div class="flex-1 relative min-w-0">
        <KeymapCanvas
          ref="canvasRef"
          :device="currentDevice"
          :bindings="activeProfile?.bindings || []"
          :screenshot-url="screenshotUrl"
          :device-width="deviceWidth"
          :device-height="deviceHeight"
          @add-binding="handleAddBinding"
          @edit-binding="handleEditBinding"
          @test-binding="handleTestBinding"
        />

        <div v-if="!screenshotUrl && currentDevice" class="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div class="text-center p-4">
            <el-icon class="text-4xl mb-2 text-gray-400">
              <PictureOutlined />
            </el-icon>
            <p class="text-gray-500 dark:text-gray-400">
              {{ $t('keymap.editor.capture') }}
            </p>
            <el-button size="small" type="primary" :disabled="capturing" @click="doCaptureScreenshot">
              {{ $t('keymap.editor.capture') }}
            </el-button>
          </div>
        </div>
      </div>

      <!-- Sidebar: Bindings List -->
      <div class="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
        <div class="p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 class="font-medium">
            {{ $t('keymap.editor.bindings') }} ({{ activeProfile?.bindings?.length || 0 }})
          </h3>
        </div>

        <div class="p-3 space-y-2">
          <div v-if="!activeProfile?.bindings?.length" class="text-center text-gray-500 dark:text-gray-400 py-8">
            <p>{{ $t('keyboard.mapping.empty.title') }}</p>
            <p class="text-sm">
              {{ $t('keyboard.mapping.empty.description') }}
            </p>
            <el-button size="small" type="primary" @click="addBinding">
              + {{ $t('common.add') }}
            </el-button>
          </div>

          <div v-for="(binding, index) in activeProfile?.bindings" :key="binding.id" class="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <el-tag size="small" :type="getActionTagType(binding.action)">
                  {{ $t(`keymap.action.${binding.action}`) }}
                </el-tag>
                <span class="text-sm truncate">{{ formatBindingParams(binding) }}</span>
              </div>
              <div class="flex items-center gap-1">
                <el-button size="small" type="primary" plain @click="handleTestBinding(binding)">
                  <el-icon><Monitor /></el-icon>
                </el-button>
                <el-button size="small" plain @click="handleEditBinding(binding, index)">
                  <el-icon><Edit /></el-icon>
                </el-button>
                <el-button size="small" type="danger" plain @click="removeBinding(index)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </div>

          <el-button v-if="activeProfile" size="small" type="primary" block @click="addBinding">
            + {{ $t('common.add') }}
          </el-button>
        </div>
      </div>
    </div>

    <!-- Binding Editor Dialog -->
    <BindingFormDialog
      ref="bindingFormRef"
      :visible="bindingFormVisible"
      :binding="editingBinding"
      :device-width="deviceWidth"
      :device-height="deviceHeight"
      :screenshot-url="screenshotUrl"
      @save="saveBinding"
      @update:visible="closeBindingForm"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useDeviceStore } from '$/store/device/index.js'
import { usePreferenceStore } from '$/store/preference/index.js'
import { useWindowStateSync } from '$/hooks/useWindowStateSync/index.js'
import { useScreenshotAction } from '$/hooks/useScreenshotAction/index.js'
import KeymapCanvas from './canvas-overlay.vue'
import BindingFormDialog from './binding-form.vue'

defineOptions({ name: 'KeymapEditor' })

const deviceStore = useDeviceStore()
const preferenceStore = usePreferenceStore()
const { currentDevice } = useWindowStateSync({ deviceSync: true })

const { invoke: captureScreenshotAction, loading: capturing } = useScreenshotAction({ silent: true })

const screenshotUrl = ref('')
const deviceWidth = ref(0)
const deviceHeight = ref(0)

const profiles = computed(() => {
  const keymapData = preferenceStore.getData(currentDevice.value?.id)?.keymap || {}
  return keymapData.profiles || []
})

const activeProfileId = ref('')
const activeProfile = computed(() => profiles.value.find(p => p.id === activeProfileId.value))

const bindingFormVisible = ref(false)
const editingBinding = ref(null)
const editingBindingIndex = ref(-1)

const canvasRef = ref(null)

watch(currentDevice, (newDevice) => {
  if (newDevice) {
    screenshotUrl.value = ''
    deviceWidth.value = 0
    deviceHeight.value = 0
    activeProfileId.value = ''

    // Load active profile
    const keymapData = preferenceStore.getData(newDevice.id)?.keymap || {}
    if (keymapData.activeProfile) {
      activeProfileId.value = keymapData.activeProfile
    }
    else if (profiles.value.length > 0) {
      activeProfileId.value = profiles.value[0].id
    }
  }
}, { immediate: true })

async function doCaptureScreenshot() {
  if (!currentDevice.value)
    return

  capturing.value = true
  try {
    const fileName = `keymap-editor-${Date.now()}.jpg`
    const deviceConfig = preferenceStore.getData(currentDevice.value.id)
    const savePath = window.$preload.path.resolve(deviceConfig.savePath, fileName)

    await window.$preload.adb.screencap(currentDevice.value.id, { savePath })

    screenshotUrl.value = `file://${savePath}`

    // Get device dimensions
    const sizeOutput = await window.$preload.adb.deviceShell(currentDevice.value.id, 'wm size')
    const match = sizeOutput.match(/(\d+)x(\d+)/)
    if (match) {
      deviceWidth.value = parseInt(match[1], 10)
      deviceHeight.value = parseInt(match[2], 10)
    }
  }
  catch (error) {
    ElMessage.error(error?.message || '截图失败')
  }
  finally {
    capturing.value = false
  }
}

function onProfileChange(profileId) {
  activeProfileId.value = profileId
  preferenceStore.setData({
    ...preferenceStore.data,
    keymap: {
      ...preferenceStore.data.keymap,
      activeProfile: profileId,
    },
  })
}

function addProfile() {
  const newProfile = {
    id: `profile_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: '',
    bindings: [],
  }
  const keymapData = preferenceStore.getData(currentDevice.value?.id)?.keymap || { profiles: [] }
  keymapData.profiles = [...(keymapData.profiles || []), newProfile]

  preferenceStore.setData({
    ...preferenceStore.data,
    keymap: keymapData,
  })

  activeProfileId.value = newProfile.id
}

function duplicateProfile(profileId) {
  const profile = profiles.value.find(p => p.id === profileId)
  if (!profile)
    return

  const newProfile = {
    ...profile,
    id: `profile_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: `${profile.name} (${$t('keymap.editor.profile.duplicate')})`,
    bindings: profile.bindings.map(b => ({ ...b, id: `binding_${Date.now()}_${Math.random().toString(36).slice(2)}` })),
  }

  const keymapData = preferenceStore.getData(currentDevice.value?.id)?.keymap || { profiles: [] }
  keymapData.profiles = [...(keymapData.profiles || []), newProfile]

  preferenceStore.setData({
    ...preferenceStore.data,
    keymap: keymapData,
  })

  activeProfileId.value = newProfile.id
}

function deleteProfile(profileId) {
  const keymapData = preferenceStore.getData(currentDevice.value?.id)?.keymap || { profiles: [] }
  keymapData.profiles = keymapData.profiles.filter(p => p.id !== profileId)

  if (keymapData.activeProfile === profileId) {
    keymapData.activeProfile = keymapData.profiles[0]?.id || ''
  }

  preferenceStore.setData({
    ...preferenceStore.data,
    keymap: keymapData,
  })

  activeProfileId.value = keymapData.activeProfile || ''
}

function exportProfile(profileId) {
  const profile = profiles.value.find(p => p.id === profileId)
  if (!profile)
    return

  const content = JSON.stringify(profile, null, 2)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `keymap-${profile.name || profile.id}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importProfile() {
  window.$preload.ipcRenderer.invoke('show-open-dialog', {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  }).then((filePaths) => {
    if (!filePaths?.length)
      return
    return window.$preload.ipcRenderer.invoke('keymap:import', filePaths[0])
  }).then((result) => {
    if (result?.success) {
      ElMessage.success('导入成功')
      // Reload profiles
    }
  }).catch((error) => {
    ElMessage.error(error?.message || '导入失败')
  })
}

function addBinding() {
  editingBinding.value = {
    id: `binding_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    action: 'keyevent',
    params: {},
    enabled: true,
    key: '',
  }
  editingBindingIndex.value = -1
  bindingFormVisible.value = true
}

function handleEditBinding(binding, index) {
  editingBinding.value = { ...binding }
  editingBindingIndex.value = index
  bindingFormVisible.value = true
}

function handleAddBinding(payload) {
  // Called from canvas when user clicks/drags
  editingBinding.value = {
    id: `binding_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    action: payload.action || 'tap',
    params: payload.params || {},
    enabled: true,
    key: '',
  }
  editingBindingIndex.value = -1
  bindingFormVisible.value = true
}

function handleTestBinding(binding) {
  if (!currentDevice.value)
    return

  window.$preload.ipcRenderer.invoke('keymap:execute', {
    serial: currentDevice.value.id,
    binding,
    profile: { bindings: [binding] },
  }).then((result) => {
    if (result.success) {
      ElMessage.success('测试执行成功')
    }
    else {
      ElMessage.error(result.error || '执行失败')
    }
  })
}

function removeBinding(index) {
  if (!activeProfile.value)
    return
  activeProfile.value.bindings = activeProfile.value.bindings.filter((_, i) => i !== index)
  saveProfile()
}

function saveBinding(binding) {
  if (!activeProfile.value)
    return

  if (editingBindingIndex.value >= 0) {
    activeProfile.value.bindings[editingBindingIndex.value] = binding
  }
  else {
    activeProfile.value.bindings = [...(activeProfile.value.bindings || []), binding]
  }

  saveProfile()
  closeBindingForm()
}

function closeBindingForm() {
  bindingFormVisible.value = false
  editingBinding.value = null
  editingBindingIndex.value = -1
}

function saveProfile() {
  const keymapData = preferenceStore.getData(currentDevice.value?.id)?.keymap || { profiles: [] }
  const profileIndex = keymapData.profiles.findIndex(p => p.id === activeProfileId.value)
  if (profileIndex >= 0) {
    keymapData.profiles[profileIndex] = { ...activeProfile.value }
  }

  preferenceStore.setData({
    ...preferenceStore.data,
    keymap: keymapData,
  })
}

function formatBindingParams(binding) {
  const { action, params } = binding
  switch (action) {
    case 'keyevent':
      return `Keyevent: ${params.code || '未设置'}`
    case 'tap':
      return `Tap: (${params.x || 0}, ${params.y || 0})`
    case 'swipe':
      return `Swipe: (${params.startX || 0}, ${params.startY || 0}) -> (${params.endX || 0}, ${params.endY || 0})`
    case 'text':
      return `Text: ${params.text || '未设置'}`
    case 'shell':
      return `Shell: ${params.command || '未设置'}`
    case 'macro':
      return `Macro: ${params.steps?.length || 0} steps`
    default:
      return JSON.stringify(params)
  }
}

function getActionTagType(action) {
  const types = {
    keyevent: 'primary',
    tap: 'success',
    swipe: 'warning',
    text: 'info',
    shell: 'danger',
    macro: 'primary',
  }
  return types[action] || 'info'
}

defineExpose({
  captureScreenshot: doCaptureScreenshot,
})
</script>

<style scoped lang="postcss">
.keymap-editor {
  @apply h-full flex flex-col;
}
</style>
