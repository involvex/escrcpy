<template>
  <slot :trigger="handleClick" />
</template>

<script setup>
defineOptions({ inheritAttrs: false })
const props = defineProps({
  device: {
    type: Object,
    default: () => ({}),
  },
})

function handleClick() {
  const device = toRaw(props.device ?? {})

  window.$preload.win.open('pages/logcat', {
    device,
    instanceId: device.id,
  })
}
</script>

<style></style>
