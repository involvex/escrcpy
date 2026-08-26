<template>
  <slot :loading="loading" :trigger="() => invoke()" />

  <OcrDialog
    v-model="dialogVisible"
    :mode="dialogMode"
    :image-src="imageSrc"
    :busy="busy"
    :text="text"
    @confirm="handleConfirm"
    @copy="handleCopy"
    @update:model-value="value => !value && handleClose()"
  />
</template>

<script setup>
import OcrDialog from '$/components/ocr-dialog/index.vue'
import useOcrAction from '$/hooks/useOcrAction/index.js'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  device: {
    type: Object,
    default: () => ({}),
  },
})

const deviceId = computed(() => props.device?.id ?? '')

const {
  loading,
  dialogVisible,
  dialogMode,
  imageSrc,
  busy,
  text,
  invoke,
  handleConfirm,
  handleCopy,
  handleClose,
} = useOcrAction(deviceId)
</script>

<style></style>
