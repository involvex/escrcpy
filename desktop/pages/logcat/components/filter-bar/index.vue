<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  search: {
    type: String,
    default: '',
  },
  priorities: {
    type: Array,
    default: () => [],
  },
  tagText: {
    type: String,
    default: '',
  },
  tagMode: {
    type: String,
    default: 'exclude',
  },
  packageName: {
    type: String,
    default: '',
  },
  pidMap: {
    type: Map,
    default: () => new Map(),
  },
})

const emit = defineEmits([
  'update:search',
  'update:priorities',
  'update:tagText',
  'update:tagMode',
  'update:packageName',
  'refresh-pids',
])

const priorityOptions = [
  { value: 2, label: 'V' },
  { value: 3, label: 'D' },
  { value: 4, label: 'I' },
  { value: 5, label: 'W' },
  { value: 6, label: 'E' },
  { value: 7, label: 'F' },
]

const packageOptions = computed(() => {
  return [...props.pidMap.keys()].map(name => ({
    value: name,
    label: name,
  }))
})

// Filter presets
const presets = computed(() => window.$preload?.store?.get('logcat.filterPresets') || [])
const showPresetDropdown = ref(false)
const newPresetName = ref('')

function savePreset() {
  const name = newPresetName.value.trim()
  if (!name) {
    ElMessage.warning(window.t('logcat.preset.savePrompt'))
    return
  }

  const preset = {
    name,
    search: props.search,
    priorities: [...props.priorities],
    tagText: props.tagText,
    tagMode: props.tagMode,
    packageName: props.packageName,
    createdAt: Date.now(),
  }

  const updated = [...presets.value, preset]
  window.$preload.store.set('logcat.filterPresets', updated)
  newPresetName.value = ''
  showPresetDropdown.value = false
  ElMessage.success(window.t('logcat.preset.save'))
}

function loadPreset(preset) {
  emit('update:search', preset.search || '')
  emit('update:priorities', preset.priorities || [])
  emit('update:tagText', preset.tagText || '')
  emit('update:tagMode', preset.tagMode || 'exclude')
  emit('update:packageName', preset.packageName || '')
  showPresetDropdown.value = false
  ElMessage.success(window.t('logcat.preset.load'))
}

function deletePreset(index) {
  const updated = presets.value.filter((_, i) => i !== index)
  window.$preload.store.set('logcat.filterPresets', updated)
  ElMessage.success(window.t('logcat.preset.delete'))
}

function startSavePreset() {
  newPresetName.value = ''
  showPresetDropdown.value = true
  // Focus the input after dropdown opens
  nextTick(() => {
    const input = document.querySelector('.preset-name-input')
    input?.focus()
  })
}
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap px-2 py-1">
    <el-input
      :model-value="search"
      class="!w-56"
      size="small"
      clearable
      :placeholder="$t('logcat.filter.search')"
      prefix-icon="Search"
      @update:model-value="emit('update:search', $event)"
    />

    <el-select
      :model-value="priorities"
      class="!w-36"
      size="small"
      multiple
      collapse-tags
      :placeholder="$t('logcat.filter.priority')"
      @update:model-value="emit('update:priorities', $event)"
    >
      <el-option
        v-for="option of priorityOptions"
        :key="option.value"
        :value="option.value"
        :label="option.label"
      />
    </el-select>

    <el-select
      :model-value="tagMode"
      class="!w-28"
      size="small"
      @update:model-value="emit('update:tagMode', $event)"
    >
      <el-option value="include" :label="$t('logcat.filter.tagInclude')" />
      <el-option value="exclude" :label="$t('logcat.filter.tagExclude')" />
    </el-select>

    <el-input
      :model-value="tagText"
      class="!w-48"
      size="small"
      clearable
      :placeholder="$t('logcat.filter.tags')"
      @update:model-value="emit('update:tagText', $event)"
    />

    <el-select
      :model-value="packageName"
      class="!w-64"
      size="small"
      filterable
      clearable
      :placeholder="$t('logcat.filter.package')"
      @update:model-value="emit('update:packageName', $event)"
    >
      <el-option
        v-for="option of packageOptions"
        :key="option.value"
        :value="option.value"
        :label="option.label"
      />
    </el-select>

    <el-tooltip :content="$t('logcat.filter.refreshPs')">
      <el-button size="small" text icon="Refresh" @click="emit('refresh-pids')" />
    </el-tooltip>

    <!-- Filter Presets Dropdown -->
    <el-dropdown v-model:visible="showPresetDropdown" size="small" trigger="click" hide-on-click>
      <el-button :icon="presets.length ? 'Collection' : 'Plus'" :type="presets.length ? '' : 'primary'" @click="presets.length ? null : startSavePreset">
        {{ presets.length ? $t('logcat.preset.load') : $t('logcat.preset.save') }}
      </el-button>
      <template #dropdown>
        <el-dropdown-menu class="w-64">
          <el-dropdown-item divided class="px-2 py-1">
            <el-input
              v-model="newPresetName"
              class="preset-name-input w-full"
              size="small"
              :placeholder="$t('logcat.preset.savePrompt')"
              @keydown.enter="savePreset"
            />
            <el-button size="small" type="primary" class="mt-1 w-full" @click="savePreset">
              {{ $t('logcat.preset.save') }}
            </el-button>
          </el-dropdown-item>
          <el-dropdown-item v-for="(preset, index) in presets" :key="preset.name" divided class="flex items-center justify-between px-2 py-1.5">
            <span class="truncate flex-1" @click="loadPreset(preset)">{{ preset.name }}</span>
            <el-button size="small" type="danger" text icon="Delete" @click.stop="deletePreset(index)" />
          </el-dropdown-item>
          <el-dropdown-item v-if="!presets.length" disabled class="text-center text-gray-500 px-2 py-2">
            {{ $t('logcat.preset.savePrompt') }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style scoped></style>
