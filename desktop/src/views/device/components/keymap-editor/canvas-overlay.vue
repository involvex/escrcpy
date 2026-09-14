<template>
  <div class="relative w-full h-full" @click="handleCanvasClick">
    <div v-if="screenshotUrl" class="relative w-full h-full">
      <img
        ref="imageRef"
        :src="screenshotUrl"
        class="w-full h-full object-contain"
        @load="onImageLoad"
      />

      <!-- Bindings overlay -->
      <svg
        v-if="imageNaturalWidth && imageNaturalHeight"
        class="absolute top-0 left-0 w-full h-full pointer-events-none"
        :viewBox="`0 0 ${imageNaturalWidth} ${imageNaturalHeight}`"
      >
        <g v-for="(binding, index) in bindings" :key="binding.id">
          <!-- Tap/Swipe markers -->
          <g v-if="binding.action === 'tap' && binding.params.x !== undefined" class="cursor-pointer" @click.stop="handleBindingClick(binding, index)">
            <circle
              :cx="scaleX(binding.params.x)"
              :cy="scaleY(binding.params.y)"
              r="20"
              fill="rgba(16, 185, 129, 0.3)"
              stroke="#10b981"
              stroke-width="2"
            />
            <circle
              :cx="scaleX(binding.params.x)"
              :cy="scaleY(binding.params.y)"
              r="6"
              fill="#10b981"
            />
            <text
              :x="scaleX(binding.params.x)"
              :y="scaleY(binding.params.y) - 28"
              text-anchor="middle"
              font-size="12"
              fill="#10b981"
              font-weight="bold"
            >
              {{ binding.key || 'T' }}
            </text>
          </g>

          <g v-if="binding.action === 'swipe' && binding.params.startX !== undefined" class="cursor-pointer" @click.stop="handleBindingClick(binding, index)">
            <line
              :x1="scaleX(binding.params.startX)"
              :y1="scaleY(binding.params.startY)"
              :x2="scaleX(binding.params.endX)"
              :y2="scaleY(binding.params.endY)"
              stroke="#f59e0b"
              stroke-width="3"
              stroke-linecap="round"
              marker-end="url(#arrowhead)"
            />
            <circle
              :cx="scaleX(binding.params.startX)"
              :cy="scaleY(binding.params.startY)"
              r="8"
              fill="#f59e0b"
            />
            <circle
              :cx="scaleX(binding.params.endX)"
              :cy="scaleY(binding.params.endY)"
              r="8"
              fill="#f59e0b"
              fill-opacity="0.5"
            />
            <text
              :x="(scaleX(binding.params.startX) + scaleX(binding.params.endX)) / 2"
              :y="(scaleY(binding.params.startY) + scaleY(binding.params.endY)) / 2 - 15"
              text-anchor="middle"
              font-size="12"
              fill="#f59e0b"
              font-weight="bold"
            >
              {{ binding.key || 'S' }}
            </text>
          </g>

          <!-- Keyevent/Text/Shell/Macro - show as floating badges at top -->
          <g v-if="['keyevent', 'text', 'shell', 'macro'].includes(binding.action)" :transform="`translate(10, ${30 + index * 30})`" class="cursor-pointer" @click.stop="handleBindingClick(binding, index)">
            <rect
              width="200"
              height="24"
              rx="4"
              :fill="getActionColor(binding.action)"
              fill-opacity="0.9"
            />
            <text x="10" y="16" font-size="11" fill="white" font-weight="500">
              {{ binding.key || 'K' }}: {{ $t(`keymap.action.${binding.action}`) }}
            </text>
          </g>
        </g>

        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
          </marker>
        </defs>
      </svg>

      <!-- Adding new binding mode -->
      <div v-if="addingMode" class="absolute inset-0 bg-black/10" @click="cancelAddMode">
        <div
          v-if="addingMode === 'tap'"
          class="absolute w-10 h-10 border-2 border-dashed border-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          :style="{ left: `${addX}px`, top: `${addY}px` }"
        />
        <div
          v-if="addingMode === 'swipe'"
          class="absolute inset-0 pointer-events-none"
        >
          <svg class="w-full h-full">
            <line
              :x1="swipeStartX"
              :y1="swipeStartY"
              :x2="addX"
              :y2="addY"
              stroke="#3b82f6"
              stroke-width="3"
              stroke-linecap="round"
              stroke-dasharray="5,5"
              marker-end="url(#arrowhead-add)"
            />
            <circle :cx="swipeStartX" :cy="swipeStartY" r="8" fill="#3b82f6" />
            <circle :cx="addX" :cy="addY" r="8" fill="#3b82f6" fill-opacity="0.5" />
          </svg>
          <defs>
            <marker id="arrowhead-add" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
            </marker>
          </defs>
        </div>
      </div>
    </div>

    <div v-else class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
      <slot name="empty" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  device: { type: Object, default: null },
  bindings: { type: Array, default: () => [] },
  screenshotUrl: { type: String, default: '' },
  deviceWidth: { type: Number, default: 0 },
  deviceHeight: { type: Number, default: 0 },
})

defineEmits(['add-binding', 'edit-binding', 'test-binding'])

const imageRef = ref(null)
const imageNaturalWidth = ref(0)
const imageNaturalHeight = ref(0)

const addingMode = ref(null) // 'tap' | 'swipe' | null
const addX = ref(0)
const addY = ref(0)
const swipeStartX = ref(0)
const swipeStartY = ref(0)

function onImageLoad() {
  if (imageRef.value) {
    imageNaturalWidth.value = imageRef.value.naturalWidth
    imageNaturalHeight.value = imageRef.value.naturalHeight
  }
}

const scaleX = (x) => {
  if (!imageNaturalWidth.value || !deviceWidth)
    return 0
  return (x / deviceWidth) * imageNaturalWidth.value
}

const scaleY = (y) => {
  if (!imageNaturalHeight.value || !deviceHeight)
    return 0
  return (y / deviceHeight) * imageNaturalHeight.value
}

function handleCanvasClick(event) {
  if (addingMode.value === 'tap') {
    const rect = imageRef.value.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Convert to device coordinates
    const deviceX = (x / imageNaturalWidth.value) * deviceWidth
    const deviceY = (y / imageNaturalHeight.value) * deviceHeight

    emit('add-binding', { action: 'tap', params: { x: Math.round(deviceX), y: Math.round(deviceY) } })
    cancelAddMode()
  }
  else if (addingMode.value === 'swipe') {
    const rect = imageRef.value.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    const deviceStartX = (swipeStartX.value / imageNaturalWidth.value) * deviceWidth
    const deviceStartY = (swipeStartY.value / imageNaturalHeight.value) * deviceHeight
    const deviceEndX = (x / imageNaturalWidth.value) * deviceWidth
    const deviceEndY = (y / imageNaturalHeight.value) * deviceHeight

    emit('add-binding', {
      action: 'swipe',
      params: {
        startX: Math.round(deviceStartX),
        startY: Math.round(deviceStartY),
        endX: Math.round(deviceEndX),
        endY: Math.round(deviceEndY),
      },
    })
    cancelAddMode()
  }
}

function cancelAddMode() {
  addingMode.value = null
  addX.value = 0
  addY.value = 0
  swipeStartX.value = 0
  swipeStartY.value = 0
}

function handleBindingClick(binding, index) {
  emit('edit-binding', binding, index)
}

function getActionColor(action) {
  const colors = {
    keyevent: '#3b82f6',
    text: '#06b6d4',
    shell: '#ef4444',
    macro: '#8b5cf6',
  }
  return colors[action] || '#6b7280'
}

defineExpose({
  startAddTap() {
    addingMode.value = 'tap'
  },
  startAddSwipe() {
    addingMode.value = 'swipe'
  },
})
</script>

<style scoped lang="postcss">
.keymap-canvas {
  @apply relative w-full h-full;
}

.keymap-canvas svg {
  @apply absolute top-0 left-0;
}

.keymap-canvas img {
  @apply w-full h-full object-contain;
}
</style>
