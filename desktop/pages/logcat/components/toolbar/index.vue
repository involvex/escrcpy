<script setup>
const props = defineProps({
  connected: {
    type: Boolean,
    default: false,
  },
  connecting: {
    type: Boolean,
    default: false,
  },
  paused: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle-pause', 'clear', 'export', 'reconnect'])

const pauseLabel = computed(() => {
  return props.paused ? 'logcat.toolbar.resume' : 'logcat.toolbar.pause'
})

const pauseIcon = computed(() => {
  return props.paused ? 'VideoPlay' : 'VideoPause'
})
</script>

<template>
  <div class="flex items-center gap-2 px-2 py-1 *:app-region-no-drag">
    <span
      class="flex-none inline-flex items-center gap-1 text-xs"
      :class="connected ? 'text-green-600 dark:text-green-400' : 'text-gray-400'"
    >
      <i
        class="inline-block size-2 rounded-full"
        :class="connected ? 'bg-green-500' : 'bg-gray-400'"
      ></i>
      {{ connected
        ? $t('logcat.status.connected')
        : connecting
          ? $t('logcat.status.connecting')
          : $t('logcat.status.disconnected') }}
    </span>

    <div class="flex-1"></div>

    <el-button-group>
      <el-button
        size="small"
        :icon="pauseIcon"
        :disabled="!connected && !paused"
        @click="emit('toggle-pause')"
      >
        {{ $t(pauseLabel) }}
      </el-button>

      <el-button size="small" icon="Delete" @click="emit('clear')">
        {{ $t('logcat.toolbar.clear') }}
      </el-button>

      <el-button size="small" icon="Download" @click="emit('export')">
        {{ $t('logcat.toolbar.export') }}
      </el-button>
    </el-button-group>

    <el-tooltip v-if="!connected" :content="$t('logcat.toolbar.reconnect')">
      <el-button
        size="small"
        type="primary"
        icon="RefreshRight"
        :loading="connecting"
        @click="emit('reconnect')"
      />
    </el-tooltip>
  </div>
</template>

<style scoped></style>
