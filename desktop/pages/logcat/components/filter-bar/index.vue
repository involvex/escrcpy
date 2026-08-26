<script setup>
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
  </div>
</template>

<style scoped></style>
