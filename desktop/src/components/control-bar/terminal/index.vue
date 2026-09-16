<template>
  <slot :trigger="handleTrigger" />
</template>

<script setup>
const props = defineProps({
  device: {
    type: Object,
    default: () => ({}),
  },
  floating: {
    type: Boolean,
    default: false,
  },
})

async function handleTrigger() {
  const device = toRaw(props.device ?? {})
  const useSystem = window.$preload.store.get('common.enableSystemTerminal') === true

  if (useSystem && device.id) {
    const result = await window.$preload.ipcRenderer.invoke('open-system-terminal', {
      command: `adb -s ${device.id} shell`,
    })
    if (!result?.success) {
      ElMessage.warning(result?.error || 'Failed to open system terminal')
    }
    return
  }

  window.$preload.win.open('pages/terminal', {
    title: 'terminal.command.name',
    type: 'device',
    device,
    instanceId: device.id,
  })
}
</script>

<style></style>
