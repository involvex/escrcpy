<script setup>
const props = defineProps({
  count: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['jump'])
</script>

<template>
  <div
    v-if="count > 0"
    class="flex items-center gap-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300"
  >
    <i class="i-bi-exclamation-triangle-fill"></i>
    <span>{{ $t('logcat.crash.detected', { count }) }}</span>

    <el-button size="small" text type="danger" icon="Aim" @click="emit('jump')">
      {{ $t('logcat.crash.jump') }}
    </el-button>
  </div>
</template>

<style scoped></style>
