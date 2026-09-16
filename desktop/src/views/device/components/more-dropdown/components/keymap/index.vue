<template>
  <el-dropdown-item :disabled="loading" @click="navigateToKeymapEditor">
    <template v-if="loading">
      <el-icon class="is-loading">
        <Loading />
      </el-icon>
      {{ $t('common.starting') }}
    </template>
    <template v-else>
      <el-icon class="mr-1">
        <Key />
      </el-icon>
      {{ $t('device.actions.more.keymap.name') }}
    </template>
  </el-dropdown-item>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  row: { type: Object, default: () => ({}) },
  device: { type: Object, default: null },
})

const device = computed(() => props.device || props.row)

const router = useRouter()
const loading = ref(false)

async function navigateToKeymapEditor() {
  if (!device.value?.id || ['unauthorized', 'offline'].includes(device.value.status))
    return

  loading.value = true
  try {
    router.push({ name: 'device-keymap-editor', params: { serial: device.value.id } })
  }
  finally {
    loading.value = false
  }
}

defineExpose({
  navigateToKeymapEditor,
})
</script>

<style scoped lang="postcss">
.keymap-dropdown-item {
  @apply flex items-center gap-2;
}
</style>
