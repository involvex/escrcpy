<template>
  <slot />
</template>

<script setup>
import pLimit from 'p-limit'

import { runAutomationSteps } from '$/utils/automation/index.js'

defineOptions({ inheritAttrs: false })

const scheduleStore = useScheduleStore()

const loading = ref(false)

scheduleStore.on('automation', (schedule) => {
  scheduleStore.start({
    schedule,
    handler: executeAutomation,
  })
})

function getDeviceId(device) {
  return typeof device === 'string' ? device : device?.id
}

async function executeAutomation(devices, { payload } = {}) {
  const steps = payload?.automationConfig?.steps || []

  const targets = (devices || []).map(getDeviceId).filter(Boolean)

  if (!targets.length) {
    ElMessage.warning(window.t('device.schedule.noDeviceSelected'))
    return false
  }

  loading.value = true

  try {
    const concurrencyLimit = Number(window.$preload.store.get('common.concurrencyLimit') ?? 3)
    const limit = pLimit(Math.max(1, Math.min(concurrencyLimit, targets.length)))

    const settled = await Promise.allSettled(
      targets.map(deviceId => limit(() => runAutomationSteps(steps, { deviceId }))),
    )

    const failed = settled.filter(item => item.status === 'rejected')

    if (failed.length === targets.length) {
      throw failed[0].reason
    }

    return failed.length === 0
  }
  finally {
    loading.value = false
  }
}

defineExpose({
  loading,
})
</script>

<style></style>
