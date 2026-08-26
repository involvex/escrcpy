<script setup>
import AppHeader from '$/components/app-header/index.vue'
import useLogcat from '$/hooks/useLogcat/index.js'
import FilterBar from './components/filter-bar/index.vue'
import LogTable from './components/log-table/index.vue'
import Toolbar from './components/toolbar/index.vue'
import CrashBanner from './components/crash-banner/index.vue'

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
  filteredEntries,
  connected,
  connecting,
  paused,
  search,
  priorities,
  tagText,
  tagMode,
  packageName,
  pidMap,
  crashCount,
  firstCrashIndex,
  collectedCount,
  connect,
  clear,
  togglePause,
  refreshPidMap,
  exportLog,
} = useLogcat(deviceId)

const logTableRef = ref()

onMounted(async () => {
  const currentDeviceId = deviceId.value

  if (!currentDeviceId) {
    return
  }

  await deviceStore.getList()

  document.title = deviceStore.getLabel(currentDeviceId, 'logcat')

  connect()
})

watch(deviceId, (value) => {
  if (!value) {
    return
  }

  connect()
})

function handleJumpToCrash() {
  if (firstCrashIndex.value >= 0) {
    logTableRef.value?.scrollToIndex(firstCrashIndex.value)
  }
}

function handleRefreshClick() {
  window.location.reload()
}
</script>

<template>
  <el-config-provider :locale="locale" :size="size">
    <div class="flex flex-col h-screen">
      <AppHeader
        :title="$t('logcat.name')"
        :device-name="deviceName"
        class="px-2"
      >
        <template #right>
          <div class="flex items-center *:app-region-no-drag">
            <el-button
              circle
              text
              icon="Refresh"
              :title="$t('device.refresh.name')"
              @click="handleRefreshClick"
            />
          </div>
        </template>
      </AppHeader>

      <Toolbar
        class="border-b border-gray-200 dark:border-gray-700"
        :connected="connected"
        :connecting="connecting"
        :paused="paused"
        @toggle-pause="togglePause"
        @clear="clear"
        @export="exportLog"
        @reconnect="connect({ clear: true })"
      />

      <FilterBar
        v-model:search="search"
        v-model:priorities="priorities"
        v-model:tag-text="tagText"
        v-model:tag-mode="tagMode"
        v-model:package-name="packageName"
        :pid-map="pidMap"
        @refresh-pids="refreshPidMap"
      />

      <CrashBanner :count="crashCount" @jump="handleJumpToCrash" />

      <div class="flex-1 min-h-0 border-t border-gray-200 dark:border-gray-700">
        <LogTable ref="logTableRef" :entries="filteredEntries" />
      </div>

      <div class="flex items-center px-2 h-7 text-xs text-gray-500 border-t border-gray-200 dark:border-gray-700">
        {{ $t('logcat.status.lines', { shown: filteredEntries.length, total: collectedCount }) }}
      </div>
    </div>
  </el-config-provider>
</template>

<style scoped></style>
