<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

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

const emit = defineEmits(['filter-by-pid', 'filter-by-tag', 'copy-pid', 'copy-tag', 'copy-message'])

const ROW_HEIGHT = 22
const OVERSCAN = 10

const containerRef = ref()
const scrollTop = ref(0)
const viewportHeight = ref(400)

// Context menu state
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextEntry = ref(null)

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

function onContextMenu(event, entry) {
  event.preventDefault()
  event.stopPropagation()
  contextEntry.value = entry
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
}

function closeContextMenu() {
  contextMenuVisible.value = false
  contextEntry.value = null
}

function handleFilterByPid() {
  if (!contextEntry.value) {
    return
  }
  emit('filter-by-pid', contextEntry.value.pid)
  closeContextMenu()
}

function handleFilterByTag() {
  if (!contextEntry.value) {
    return
  }
  emit('filter-by-tag', contextEntry.value.tag)
  closeContextMenu()
}

function handleCopyPid() {
  if (!contextEntry.value) {
    return
  }
  navigator.clipboard.writeText(String(contextEntry.value.pid))
  closeContextMenu()
  ElMessage.success(window.t('logcat.context.copyPid'))
}

function handleCopyTag() {
  if (!contextEntry.value) {
    return
  }
  navigator.clipboard.writeText(contextEntry.value.tag)
  closeContextMenu()
  ElMessage.success(window.t('logcat.context.copyTag'))
}

function handleCopyMessage() {
  if (!contextEntry.value) {
    return
  }
  navigator.clipboard.writeText(contextEntry.value.message)
  closeContextMenu()
  ElMessage.success(window.t('logcat.context.copyMessage'))
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

  // Close context menu on click outside
  document.addEventListener('click', closeContextMenu)
  document.addEventListener('scroll', closeContextMenu, true)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  document.removeEventListener('click', closeContextMenu)
  document.removeEventListener('scroll', closeContextMenu, true)
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
        @contextmenu="onContextMenu"
      >
        <span class="flex-none opacity-60">{{ entry.time }}</span>
        <span class="flex-none w-3 text-center font-bold">{{ entry.level }}</span>
        <span class="flex-none max-w-[180px] truncate opacity-80">{{ entry.tag }}</span>
        <span class="flex-none opacity-50">({{ entry.pid }})</span>
        <span class="truncate" :title="entry.message">{{ entry.message }}</span>
      </div>
    </div>
  </div>

  <!-- Context Menu -->
  <div
    v-if="contextMenuVisible"
    class="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 min-w-[160px]"
    :style="{ left: `${contextMenuX}px`, top: `${contextMenuY}px` }"
    @click.stop
  >
    <div class="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
      PID: {{ contextEntry?.pid }} | {{ contextEntry?.tag }}
    </div>
    <button
      class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      @click="handleFilterByPid"
    >
      <i class="i-bi-funnel"></i>
      {{ $t('logcat.context.filterByPid') }}
    </button>
    <button
      class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      @click="handleFilterByTag"
    >
      <i class="i-bi-tag"></i>
      {{ $t('logcat.context.filterByTag') }}
    </button>
    <hr class="border-gray-200 dark:border-gray-700 my-1" />
    <button
      class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      @click="handleCopyPid"
    >
      <i class="i-bi-clipboard"></i>
      {{ $t('logcat.context.copyPid') }}
    </button>
    <button
      class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      @click="handleCopyTag"
    >
      <i class="i-bi-tag"></i>
      {{ $t('logcat.context.copyTag') }}
    </button>
    <button
      class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      @click="handleCopyMessage"
    >
      <i class="i-bi-clipboard-text"></i>
      {{ $t('logcat.context.copyMessage') }}
    </button>
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
