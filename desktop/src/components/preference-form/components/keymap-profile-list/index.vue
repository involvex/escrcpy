<template>
  <div class="space-y-3">
    <el-alert
      v-if="!profiles.length"
      title="暂无映射方案"
      description="点击下方按钮创建第一个方案"
      type="info"
      show-icon
      class="mb-2"
    />

    <div v-for="(profile, index) in profiles" :key="profile.id" class="border rounded p-3 space-y-2">
      <div class="flex items-center justify-between">
        <el-input
          v-model="profile.name"
          size="small"
          placeholder="方案名称"
          class="!w-48"
          @input="emitChange"
        />
        <div class="flex items-center gap-2">
          <el-tag :type="activeProfile === profile.id ? 'success' : 'info'" size="small" disable-transitions>
            {{ activeProfile === profile.id ? $t('common.enabled') : $t('common.disabled') }}
          </el-tag>
          <el-button
            v-if="activeProfile !== profile.id"
            size="small"
            type="primary"
            plain
            @click="setActive(profile.id)"
          >
            {{ $t('common.enable') }}
          </el-button>
          <el-button size="small" plain @click="duplicate(profile)">
            {{ $t('keymap.editor.profile.duplicate') }}
          </el-button>
          <el-button size="small" type="danger" plain @click="remove(index)">
            {{ $t('common.delete') }}
          </el-button>
        </div>
      </div>

      <el-collapse v-model="expandedProfiles" accordion>
        <el-collapse-item :name="profile.id">
          <template #title>
            <span class="font-medium">{{ $t('keymap.editor.binding.action') }} ({{ profile.bindings?.length || 0 }})</span>
          </template>
          <div class="space-y-2 pt-2">
            <div v-for="(binding, bIndex) in profile.bindings" :key="binding.id" class="flex items-center gap-2 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded">
              <el-tag size="small" effect="plain">
                {{ binding.action }}
              </el-tag>
              <span class="flex-1 text-sm text-gray-600 dark:text-gray-400 truncate">
                {{ formatBindingParams(binding) }}
              </span>
              <el-button size="small" text @click="editBinding(profile.id, bIndex)">
                {{ $t('common.edit') }}
              </el-button>
              <el-button size="small" type="danger" text @click="removeBinding(profile.id, bIndex)">
                {{ $t('common.delete') }}
              </el-button>
            </div>
            <el-button size="small" type="primary" plain @click="addBinding(profile.id)">
              + {{ $t('keymap.editor.profile.new') }}
            </el-button>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>

    <el-button type="primary" @click="addProfile">
      + {{ $t('keymap.editor.profile.new') }}
    </el-button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  data: {
    type: Object,
    default: () => ({}),
  },
  preferenceData: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['update:model-value'])

const profiles = computed({
  get() {
    return props.modelValue
  },
  set(value) {
    emit('update:model-value', value)
  },
})

const activeProfile = computed({
  get() {
    return props.preferenceData?.keymap?.activeProfile || ''
  },
  set(value) {
    // This is handled by the parent preference form
  },
})

const expandedProfiles = ref([])

function emitChange() {
  emit('update:model-value', profiles.value)
}

function addProfile() {
  const newProfile = {
    id: `profile_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: '',
    bindings: [],
  }
  profiles.value = [...profiles.value, newProfile]
  expandedProfiles.value = [newProfile.id]
}

function remove(index) {
  profiles.value = profiles.value.filter((_, i) => i !== index)
}

function setActive(profileId) {
  // The activeProfile is managed by the preference form's activeProfile field
  // We just emit a change to trigger the parent to update
  emit('update:model-value', profiles.value)
}

function duplicate(profile) {
  const newProfile = {
    ...profile,
    id: `profile_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: `${profile.name} (副本)`,
    bindings: profile.bindings.map(b => ({ ...b, id: `binding_${Date.now()}_${Math.random().toString(36).slice(2)}` })),
  }
  profiles.value = [...profiles.value, newProfile]
}

function addBinding(profileId) {
  const profile = profiles.value.find(p => p.id === profileId)
  if (!profile)
    return
  const newBinding = {
    id: `binding_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    action: 'keyevent',
    params: {},
    enabled: true,
  }
  profile.bindings = [...(profile.bindings || []), newBinding]
  emitChange()
}

function removeBinding(profileId, bIndex) {
  const profile = profiles.value.find(p => p.id === profileId)
  if (!profile)
    return
  profile.bindings = profile.bindings.filter((_, i) => i !== bIndex)
  emitChange()
}

function editBinding(profileId, bIndex) {
  // TODO: Open binding editor dialog
  console.log('Edit binding', profileId, bIndex)
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

defineExpose({
  // Expose methods if needed
})
</script>

<style scoped></style>
