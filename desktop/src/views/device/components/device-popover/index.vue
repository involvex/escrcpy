<template>
  <el-popover
    ref="popoverRef"
    placement="right"
    :width="horizontalFlag ? 350 : 500"
    trigger="hover"
    popper-class="!p-0 !overflow-hidden !rounded-xl"
    :show-after="500"
    :disabled="!connectFlag"
    @before-enter="onBeforeEnter"
    @before-leave="onBeforeLeave"
    @after-leave="onAfterLeave"
  >
    <template #reference>
      <el-link type="primary" underline="never" icon="InfoFilled" :disabled="!connectFlag" class="flex-none"></el-link>
    </template>

    <div v-loading="loading" :element-loading-text="$t('common.loading')" class="flex items-stretch p-2" :class="[horizontalFlag ? 'flex-col space-y-2' : 'space-x-2 h-60', { '!h-auto': !connectFlag }]">
      <img v-if="connectFlag" :src="deviceInfo.screencap" :class="[horizontalFlag ? 'w-full' : 'h-full']" class="flex-none overflow-hidden rounded-xl shadow bg-gray-200 dark:bg-black object-contain cursor-pointer" alt="" @load="onScreencapLoad" @click="handlePreview" />

      <div class="overflow-auto" :class="[horizontalFlag ? 'flex-none max-h-56' : 'h-full flex-1 w-0']">
        <el-descriptions border :column="1" class="el-descriptions--custom">
          <el-descriptions-item :label="$t('device.serial')">
            {{ deviceInfo.id }}
          </el-descriptions-item>

          <template v-if="liveBattery">
            <el-descriptions-item :label="$t('device.battery')">
              {{ liveBattery.batteryPercentage ? `${liveBattery.batteryPercentage}%` : '-' }}
            </el-descriptions-item>
            <el-descriptions-item :label="$t('device.isCharging')">
              {{ liveBattery.isCharging ? $t('common.yes') : $t('common.no') }}
            </el-descriptions-item>
            <el-descriptions-item :label="$t('device.temperature')">
              {{ liveBattery.temperatureCelsius ? `${liveBattery.temperatureCelsius}℃` : '-' }}
            </el-descriptions-item>
            <el-descriptions-item :label="$t('device.powerSource')">
              {{ liveBattery.powerSource || '-' }}
            </el-descriptions-item>
            <el-descriptions-item :label="$t('device.voltage')">
              {{ liveBattery.voltageV ? `${liveBattery.voltageV}v` : '-' }}
            </el-descriptions-item>
          </template>
        </el-descriptions>

        <svg
          v-if="batterySparkPath"
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          class="w-full h-6 mt-2 text-primary-500"
        >
          <path
            :d="batterySparkPath"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
      </div>
    </div>

    <el-image-viewer v-if="imageViewerProps.visible" :url-list="[deviceInfo.screencap]" @close="onViewerClose" />
  </el-popover>
</template>

<script setup>
import { buildSparklinePath } from '$/utils/device/telemetry/index.js'

const props = defineProps({
  device: {
    type: Object,
    default: () => ({}),
  },
})

const telemetryStore = useTelemetryStore()

const loading = ref(false)

const deviceInfo = ref({
  screencap: void 0,
  battery: void 0,
})

const liveBattery = computed(() => {
  return telemetryStore.entries[props.device.id]?.battery || deviceInfo.value.battery
})

const batterySparkPath = computed(() => {
  const levels = (telemetryStore.samples[props.device.id] || [])
    .map(sample => sample.level)
    .filter(level => Number.isFinite(level))

  return buildSparklinePath(levels, { width: 100, height: 24 })
})

watch(
  () => telemetryStore.entries[props.device.id]?.battery,
  (battery) => {
    if (battery) {
      deviceInfo.value.battery = battery
    }
  },
)

const connectFlag = computed(() => ['device', 'emulator'].includes(props.device.status))

const screencapTimer = ref()

const imageViewerProps = ref({
  visible: false,
})

function handlePreview() {
  imageViewerProps.value.visible = true
}

function onViewerClose() {
  imageViewerProps.value.visible = false
}

const horizontalFlag = ref(false)

function onScreencapLoad(event) {
  const { naturalHeight, naturalWidth } = event.target
  horizontalFlag.value = naturalWidth > naturalHeight
}

async function onBeforeEnter() {
  Object.assign(deviceInfo.value, { ...props.device })

  if (!connectFlag.value) {
    return false
  }

  if (!deviceInfo.value.screencap) {
    loading.value = true
  }

  screencapTimer.value = setInterval(() => {
    getScreencap()
  }, 5 * 1000)

  await Promise.allSettled([getScreencap(), getBattery()])

  loading.value = false
}

async function getScreencap() {
  try {
    const screencap = await window.$preload.adb.screencap(props.device.id, { returnBase64: true })
    Object.assign(deviceInfo.value, { screencap: `data:image/png;base64,${screencap}` })
  }
  catch (error) {
    onError()
    console.warn(error?.message || error)
  }
}

async function getBattery() {
  const battery = telemetryStore.entries[props.device.id]?.battery

  if (battery) {
    deviceInfo.value.battery = battery
    return
  }

  try {
    const fetched = await window.$preload.adb.battery(props.device.id)
    Object.assign(deviceInfo.value, { battery: fetched.computed })
  }
  catch (error) {
    onError()
    console.warn(error?.message || error)
  }
}

function onBeforeLeave() {
  clearInterval(screencapTimer.value)
}

function onAfterLeave() {
  onViewerClose()
  loading.value = false
}

function onError() {
  clearInterval(screencapTimer.value)
  props.device.status = 'offline'
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    clearInterval(screencapTimer.value)
  }
  else if (connectFlag.value) {
    screencapTimer.value = setInterval(() => {
      getScreencap()
    }, 5 * 1000)
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  onAfterLeave()
})
</script>

<style lang="postcss" scoped>
:deep() .el-descriptions--custom .el-descriptions__label {
  @apply !truncate !w-0;
}
</style>
