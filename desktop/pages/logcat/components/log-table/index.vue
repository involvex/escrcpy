<script setup>
const props = defineProps({
  entries: {
    type: Array,
    default: () => [],
  },
  autoScroll: {
    type: Boolean,
    default: true,
  },
})

const ROW_HEIGHT = 22
const OVERSCAN = 10

const containerRef = ref()
const scrollTop = ref(0)
const viewportHeight = ref(400)

let stickToBottom = true

const totalHeight = computed(() => props.entries.length * ROW_HEIGHT)

const startIndex = computed(() => {
  return Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN)
})

const endIndex = computed(() => {
  const visibleCount = Math.ceil(viewportHeight.value / ROW_HEIGHT)
  return Math.min(props.entries.length, startIndex.value + visibleCount + OVERSCAN * 2)
})

const visibleEntries = computed(() => {
  return props.entries.slice(startIndex.value, endIndex.value)
})

function rowClass(entry) {
  return [
    `log-level-${entry.level}`,
    {
      'log-row--crash': entry.crash,
    },
  ]
}

function onScroll() {
  const el = containerRef.value

  if (!el) {
    return
  }

  scrollTop.value = el.scrollTop

  const maxScroll = el.scrollHeight - el.clientHeight
  stickToBottom = el.scrollTop >= maxScroll - ROW_HEIGHT * 2
}

let resizeObserver = null

function scrollToBottom() {
  nextTick(() => {
    const el = containerRef.value

    if (el) {
      el.scrollTop = el.scrollHeight
    }
  })
}

function scrollToIndex(index) {
  nextTick(() => {
    const el = containerRef.value

    if (!el) {
      return
    }

    el.scrollTop = Math.max(0, index * ROW_HEIGHT - el.clientHeight / 2)
  })
}

watch(
  () => props.entries.length,
  () => {
    if (props.autoScroll && stickToBottom) {
      scrollToBottom()
    }
  },
)

onMounted(() => {
  const el = containerRef.value

  if (el) {
    viewportHeight.value = el.clientHeight || 400

    resizeObserver = new ResizeObserver(([resizeEntry]) => {
      viewportHeight.value = resizeEntry.contentRect.height
    })

    resizeObserver.observe(el)
  }

  scrollToBottom()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

defineExpose({
  scrollToBottom,
  scrollToIndex,
})
</script>

<template>
  <div
    ref="containerRef"
    class="log-table size-full overflow-auto font-mono text-xs"
    @scroll.passive="onScroll"
  >
    <div class="relative w-full" :style="{ height: `${totalHeight}px` }">
      <div
        v-for="(entry, index) of visibleEntries"
        :key="entry.seq"
        class="log-row absolute left-0 w-full flex gap-2 px-2 leading-[22px] whitespace-nowrap"
        :class="rowClass(entry)"
        :style="{ top: `${(startIndex + index) * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }"
      >
        <span class="flex-none opacity-60">{{ entry.time }}</span>
        <span class="flex-none w-3 text-center font-bold">{{ entry.level }}</span>
        <span class="flex-none max-w-[180px] truncate opacity-80">{{ entry.tag }}</span>
        <span class="flex-none opacity-50">({{ entry.pid }})</span>
        <span class="truncate" :title="entry.message">{{ entry.message }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.log-table {
  @apply bg-white dark:bg-gray-900;
}

.log-row {
  &.log-level-V {
    @apply text-gray-400 dark:text-gray-500;
  }

  &.log-level-D {
    @apply text-sky-600 dark:text-sky-400;
  }

  &.log-level-I {
    @apply text-green-600 dark:text-green-400;
  }

  &.log-level-W {
    @apply text-amber-500 dark:text-amber-400;
  }

  &.log-level-E {
    @apply text-red-500 dark:text-red-400;
  }

  &.log-level-F {
    @apply text-red-600 dark:text-red-300 font-bold;
  }

  &.log-row--crash {
    @apply bg-red-50 dark:bg-red-900/20;

    .message {
      @apply text-red-600 dark:text-red-300;
    }
  }
}
</style>
