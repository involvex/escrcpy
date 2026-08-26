<script setup>
const props = defineProps({
  search: {
    type: String,
    default: '',
  },
  typeFilter: {
    type: String,
    default: 'all',
  },
  statusFilter: {
    type: String,
    default: 'all',
  },
})

const emit = defineEmits([
  'update:search',
  'update:typeFilter',
  'update:statusFilter',
  'refresh',
])

const typeOptions = computed(() => [
  { value: 'all', label: window.t('apps.filter.type.all') },
  { value: 'user', label: window.t('apps.filter.type.user') },
  { value: 'system', label: window.t('apps.filter.type.system') },
])

const statusOptions = computed(() => [
  { value: 'all', label: window.t('apps.filter.status.all') },
  { value: 'enabled', label: window.t('apps.filter.status.enabled') },
  { value: 'disabled', label: window.t('apps.filter.status.disabled') },
])
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap px-2 py-2">
    <el-input
      :model-value="search"
      class="!w-64"
      clearable
      :placeholder="$t('apps.search.placeholder')"
      prefix-icon="Search"
      @update:model-value="emit('update:search', $event)"
    />

    <el-select
      :model-value="typeFilter"
      class="!w-36"
      @update:model-value="emit('update:typeFilter', $event)"
    >
      <el-option
        v-for="option of typeOptions"
        :key="option.value"
        :value="option.value"
        :label="option.label"
      />
    </el-select>

    <el-select
      :model-value="statusFilter"
      class="!w-36"
      @update:model-value="emit('update:statusFilter', $event)"
    >
      <el-option
        v-for="option of statusOptions"
        :key="option.value"
        :value="option.value"
        :label="option.label"
      />
    </el-select>

    <div class="flex-1"></div>

    <el-button icon="Refresh" :title="$t('device.refresh.name')" @click="emit('refresh')" />
  </div>
</template>

<style scoped></style>
