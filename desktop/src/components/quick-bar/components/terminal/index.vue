<template>
  <slot :trigger="handleClick" />
</template>

<script setup>
import { nanoid } from 'nanoid'

defineOptions({
  inheritAttrs: false,
})

async function handleClick() {
  const useSystem = window.$preload.store.get('common.enableSystemTerminal') === true

  if (useSystem) {
    const result = await window.$preload.ipcRenderer.invoke('open-system-terminal', {})
    if (!result?.success) {
      ElMessage.warning(result?.error || 'Failed to open system terminal')
    }
    return
  }

  window.$preload.win.open('pages/terminal', {
    title: 'device.terminal.name',
    type: 'local',
    instanceId: `local_terminal_${nanoid(8)}`,
  })
}
</script>

<style></style>
