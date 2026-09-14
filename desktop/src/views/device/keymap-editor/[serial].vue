<template>
  <div class="h-full">
    <KeymapEditor ref="editorRef" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useWindowStateSync } from '$/hooks/useWindowStateSync/index.js'
import KeymapEditor from '$/views/device/components/keymap-editor/index.vue'

definePage({
  meta: {
    title: 'keymap.editor.title',
    requiresDevice: true,
  },
})

const route = useRoute()
const { currentDevice } = useWindowStateSync({ deviceSync: true })
const editorRef = ref(null)

const serial = computed(() => route.params.serial || currentDevice.value?.id)
</script>

<style scoped lang="postcss">
.keymap-editor-page {
  @apply h-full;
}
</style>
