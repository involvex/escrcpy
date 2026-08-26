<script setup>
import AppHeader from '$/components/app-header/index.vue'
import useApps from '$/hooks/useApps/index.js'
import DetailsDrawer from './components/details-drawer/index.vue'
import FiltersBar from './components/filters-bar/index.vue'
import PackageTable from './components/package-table/index.vue'

const deviceStore = useDeviceStore()
const { currentDevice, locale, size } = useWindowStateSync()

const deviceId = computed(() => currentDevice.value?.id ?? '')

const deviceName = computed(() => {
  if (!deviceId.value) {
    return ''
  }

  return deviceStore.getLabel(deviceId.value, 'name')
})

const {
  packages,
  loading,
  search,
  typeFilter,
  statusFilter,
  selection,
  filteredPackages,
  detailsVisible,
  detailsPackage,
  load,
  launch,
  uninstall,
  toggleEnabled,
  extract,
  openDetails,
} = useApps(deviceId)

onMounted(async () => {
  const currentDeviceId = deviceId.value

  if (!currentDeviceId) {
    return
  }

  await deviceStore.getList()

  document.title = deviceStore.getLabel(currentDeviceId, 'apps')

  load()
})

watch(deviceId, (value) => {
  if (!value) {
    return
  }

  load()
})

function handleSelectionChange(values) {
  selection.value = values
}

async function handleBatchUninstall() {
  await uninstall(selection.value)
}

function handleBatchExtract() {
  extract(selection.value)
}
</script>

<template>
  <el-config-provider :locale="locale" :size="size">
    <div class="flex flex-col h-screen">
      <AppHeader
        :title="$t('apps.name')"
        :device-name="deviceName"
        class="px-2"
      />

      <FiltersBar
        v-model:search="search"
        v-model:type-filter="typeFilter"
        v-model:status-filter="statusFilter"
        @refresh="load"
      />

      <div class="flex items-center px-2 pb-2 gap-2">
        <el-button
          size="small"
          type="danger"
          plain
          icon="Delete"
          :disabled="!selection.length"
          @click="handleBatchUninstall"
        >
          {{ $t('apps.batch.uninstall') }}{{ selection.length ? ` (${selection.length})` : '' }}
        </el-button>

        <el-button
          size="small"
          type="primary"
          plain
          icon="Download"
          :disabled="!selection.length"
          @click="handleBatchExtract"
        >
          {{ $t('apps.batch.extract') }}{{ selection.length ? ` (${selection.length})` : '' }}
        </el-button>
      </div>

      <div class="flex-1 min-h-0 overflow-hidden px-2">
        <PackageTable
          :packages="filteredPackages"
          :loading="loading"
          @selection-change="handleSelectionChange"
          @launch="launch"
          @uninstall="uninstall"
          @toggle-enabled="toggleEnabled"
          @extract="extract"
          @details="openDetails"
        />
      </div>

      <div class="flex items-center text-sm text-gray-500 h-10 px-2">
        {{ filteredPackages.length }} / {{ packages.length }} {{ $t('common.item') }}
      </div>
    </div>

    <DetailsDrawer v-model:visible="detailsVisible" :item="detailsPackage" />
  </el-config-provider>
</template>

<style scoped></style>
