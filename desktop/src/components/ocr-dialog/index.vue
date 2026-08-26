<script setup>
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    default: 'crop',
  },
  imageSrc: {
    type: String,
    default: '',
  },
  busy: {
    type: Boolean,
    default: false,
  },
  text: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue', 'confirm', 'copy'])

const MIN_SIZE = 8

const imgRef = ref()
const imageLoaded = ref(false)
const localText = ref('')
const textareaRef = ref()

// Selection is tracked in DISPLAYED pixels, converted to natural
// image pixels on confirm (HiDPI / scaled displays safe)
const selection = ref(null)
let dragging = false
let startPoint = null

const ratio = computed(() => {
  const el = imgRef.value

  if (!el?.naturalWidth || !el?.clientWidth) {
    return 1
  }

  return el.naturalWidth / el.clientWidth
})

const isValidSelection = computed(() => {
  return isValid(selection.value)
})

const rectStyle = computed(() => {
  if (!selection.value) {
    return {}
  }

  const { x, y, width, height } = selection.value

  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
  }
})

const sizeLabel = computed(() => {
  if (!isValidSelection.value) {
    return ''
  }

  const r = ratio.value

  return `${Math.round(selection.value.width * r)} × ${Math.round(selection.value.height * r)}`
})

function isValid(rect) {
  return !!rect && rect.width >= MIN_SIZE && rect.height >= MIN_SIZE
}

function clampPoint(x, y, box) {
  return {
    x: Math.min(Math.max(0, x), box.width),
    y: Math.min(Math.max(0, y), box.height),
  }
}

function normalizeRect(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

function onImageLoad() {
  imageLoaded.value = true
}

const overlayRef = ref()

function getBox() {
  return overlayRef.value.getBoundingClientRect()
}

function onPointerDown(event) {
  if (props.busy || !imageLoaded.value) {
    return
  }

  const box = getBox()
  startPoint = clampPoint(event.clientX - box.left, event.clientY - box.top, box)
  selection.value = { x: startPoint.x, y: startPoint.y, width: 0, height: 0 }
  dragging = true

  overlayRef.value.setPointerCapture(event.pointerId)
}

function onPointerMove(event) {
  if (!dragging) {
    return
  }

  const box = getBox()
  const point = clampPoint(event.clientX - box.left, event.clientY - box.top, box)
  selection.value = normalizeRect(startPoint, point)
}

function onPointerUp() {
  if (!dragging) {
    return
  }

  dragging = false

  if (!isValid(selection.value)) {
    selection.value = null
  }
}

function handleConfirm() {
  if (!isValidSelection.value) {
    return
  }

  const r = ratio.value

  emit('confirm', {
    x: Math.round(selection.value.x * r),
    y: Math.round(selection.value.y * r),
    width: Math.round(selection.value.width * r),
    height: Math.round(selection.value.height * r),
  })
}

function resetState() {
  selection.value = null
  dragging = false
  startPoint = null
  imageLoaded.value = false
}

watch(
  () => props.imageSrc,
  () => {
    resetState()
  },
)

watch(
  () => props.modelValue,
  (value) => {
    if (!value) {
      return
    }

    resetState()

    if (props.mode === 'result') {
      localText.value = props.text ?? ''

      nextTick(() => {
        textareaRef.value?.focus()
        textareaRef.value?.select()
      })
    }
  },
)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="$t(mode === 'crop' ? 'ocr.crop.title' : 'ocr.result.title')"
    width="min(920px, 94vw)"
    align-center
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div
      v-if="mode === 'crop'"
      v-loading="busy"
      class="flex flex-col items-center gap-3"
    >
      <div class="relative leading-none max-w-full">
        <img
          ref="imgRef"
          :src="imageSrc"
          draggable="false"
          class="block max-w-full max-h-[68vh] select-none"
          @load="onImageLoad"
        >

        <div
          v-if="imageLoaded"
          ref="overlayRef"
          class="absolute inset-0 cursor-crosshair touch-none"
          @pointerdown.prevent="onPointerDown"
          @pointermove.prevent="onPointerMove"
          @pointerup.prevent="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <div
            v-if="selection"
            class="absolute border-2 border-primary-500 bg-primary-500/20"
            :style="rectStyle"
          >
            <span
              v-if="sizeLabel"
              class="absolute -top-6 left-0 px-1 rounded bg-black/70 text-white text-xs whitespace-nowrap"
            >
              {{ sizeLabel }}
            </span>
          </div>

          <span
            v-else
            class="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm bg-black/50 text-white py-2 pointer-events-none"
          >
            {{ $t('ocr.crop.hint') }}
          </span>
        </div>
      </div>

      <div class="flex items-center gap-2 self-end *:app-region-no-drag">
        <el-button :disabled="busy || !selection" @click="selection = null">
          {{ $t('ocr.crop.reset') }}
        </el-button>

        <el-button
          type="primary"
          icon="Crop"
          :disabled="!isValidSelection || busy"
          :loading="busy"
          @click="handleConfirm"
        >
          {{ $t('ocr.crop.confirm') }}
        </el-button>
      </div>
    </div>

    <div v-else class="flex flex-col gap-3">
      <el-input
        ref="textareaRef"
        v-model="localText"
        type="textarea"
        :rows="12"
      />

      <div class="flex items-center justify-between">
        <span class="text-xs opacity-60">{{ localText.length }}</span>

        <el-button
          type="primary"
          icon="DocumentCopy"
          :disabled="!localText"
          @click="emit('copy', localText)"
        >
          {{ $t('ocr.result.copy') }}
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<style lang="postcss" scoped></style>
