<template>
  <el-config-provider :locale="locale" :size="size">
    <Layouts />
  </el-config-provider>
</template>

<script setup>
import Layouts from './layouts/index.vue'
import { isPresetDevice, LATENCY_PRESET_ARGS } from '$/utils/latency-preset/index.js'

const router = useRouter()
const preferenceStore = usePreferenceStore()
const deviceStore = useDeviceStore()

const { locale, size } = useWindowStateSync()

window.$preload.ipcRenderer.on('quit-before', async () => {
  ElLoading.service({
    lock: true,
    text: window.t('appClose.quit.loading'),
  })
})

const startApp = useStartApp()
const scheduleStore = useScheduleStore()

window.$preload.ipcRenderer.on('execute-arguments-change', async (event, params) => {
  startApp.open(params)
})

window.$preload.ipcRenderer.on('navigate-to-route', (event, route) => {
  router.push(route)
})

window.$preload.ipcRenderer.on('hotkey:mirror-max-size', async (_event, payload = {}) => {
  const deviceId = payload.deviceId
  if (!deviceId) {
    return
  }

  try {
    preferenceStore.init()

    const args = preferenceStore.scrcpyParameter(deviceId, {
      presetArgs: isPresetDevice(deviceId) ? LATENCY_PRESET_ARGS : null,
    })

    await window.$preload.scrcpy.mirror(deviceId, {
      title: deviceStore.getLabel(deviceId, 'mirror'),
      args,
    })

    ElMessage.success(
      `Mirror max size: ${payload.previous || '?'} → ${payload.maxSize}`,
    )
  }
  catch (error) {
    console.warn('[hotkey] remirror failed:', error?.message || error)
    ElMessage.warning(error?.message || 'Failed to remirror with new resolution')
  }
})

onMounted(() => {
  showTips()
  startApp.open()
  scheduleStore.recoverSchedules()
})

async function showTips() {
  const { getScrcpyPath } = window.$preload.configs || {}

  const scrcpyPath = getScrcpyPath?.({ store: window.$preload.store })

  if (scrcpyPath) {
    return false
  }

  ElMessageBox.alert(
    `<div>
      ${window.t('dependencies.lack.content', {
        name: '<a class="hover:underline text-primary-500" href="https://github.com/Genymobile/scrcpy" target="_blank">scrcpy</a>',
      })}
    <div>`,
    window.t('dependencies.lack.title'),
    {
      dangerouslyUseHTMLString: true,
    },
  )
}
</script>

<style lang="postcss">
</style>
