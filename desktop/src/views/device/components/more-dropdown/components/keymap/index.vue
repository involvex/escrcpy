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
        <Keyboard />
      </el-icon>
      {{ $t('device.actions.more.keymap.name') }}
    </template>
  </el-dropdown-item>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  device: { type: Object, required: true },
})

const router = useRouter()
const loading = ref(false)

async function navigateToKeymapEditor() {
  if (!props.device || ['unauthorized', 'offline'].includes(props.device.status))
    return

  loading.value = true
  try {
    router.push({ name: 'device-keymap-editor', params: { serial: props.device.id } })
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
