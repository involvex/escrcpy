<template>
  <div class="space-y-3">
    <el-alert
      v-if="!profiles.length"
      :title="$t('keymap.editor.profile.emptyTitle')"
      :description="$t('keymap.editor.profile.emptyDescription')"
      type="info"
      show-icon
      class="mb-2"
    />

    <div v-for="(profile, index) in profiles" :key="profile.id" class="border rounded p-3 space-y-2">
      <div class="flex items-center justify-between">
        <el-input
          v-model="profile.name"
          size="small"
          :placeholder="$t('keymap.editor.profile.placeholder')"
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
import { computed, ref, watch } from 'vue'
import { usePreferenceStore } from '$/store/preference/index.js'

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

const preferenceStore = usePreferenceStore()

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

// Update activeProfile options in the preference model when profiles change
watch(
  () => profiles.value,
  (newProfiles) => {
    const options = newProfiles.map(p => ({
      label: p.name || p.id,
      value: p.id,
    }))
    preferenceStore.setModel('keymap.children.activeProfile.options', options)
  },
  { deep: true, immediate: true },
)

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
      return `${$t('keymap.editor.binding.keyevent')}: ${params.code || $t('keymap.editor.binding.notSet')}`
    case 'tap':
      return `${$t('keymap.editor.binding.tap')}: (${params.x || 0}, ${params.y || 0})`
    case 'swipe':
      return `${$t('keymap.editor.binding.swipe')}: (${params.startX || 0}, ${params.startY || 0}) -> (${params.endX || 0}, ${params.endY || 0})`
    case 'text':
      return `${$t('keymap.editor.binding.text')}: ${params.text || $t('keymap.editor.binding.notSet')}`
    case 'shell':
      return `${$t('keymap.editor.binding.shell')}: ${params.command || $t('keymap.editor.binding.notSet')}`
    case 'macro':
      return `${$t('keymap.editor.binding.macro')}: ${params.steps?.length || 0} ${$t('keymap.editor.binding.steps')}`
    default:
      return JSON.stringify(params)
  }
}

defineExpose({
  // Expose methods if needed
})
</script>

<style scoped></style>
