<template>
  <el-dialog
    :model-value="visible"
    :title="editingIndex >= 0 ? $t('keymap.editor.binding.edit') : $t('keymap.editor.binding.add')"
    width="520"
    :before-close="handleClose"
    destroy-on-close
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="space-y-4">
      <!-- Key Input -->
      <div>
        <label class="block text-sm font-medium mb-1">{{ $t('keymap.editor.binding.key') }}</label>
        <div class="relative">
          <el-input
            v-model="form.key"
            :placeholder="$t('keymap.editor.binding.key.placeholder')"
            readonly
            @keydown.capture.prevent="handleKeyDown"
            @keyup.capture="handleKeyUp"
            @click="focusKeyInput"
          >
            <template v-if="form.key" #prefix>
              <el-icon class="text-gray-400">
                <Keyboard />
              </el-icon>
            </template>
            <template v-if="form.key" #suffix>
              <el-icon class="text-gray-400 hover:text-red-500 cursor-pointer" @click.stop="clearKey">
                <Close />
              </el-icon>
            </template>
          </el-input>
          <div v-if="waitingForKey" class="absolute inset-0 flex items-center justify-center bg-blue-500/10 border border-blue-500 rounded pointer-events-none">
            <span class="text-blue-500 text-sm font-medium">{{ $t('keymap.editor.binding.pressKey') }}</span>
          </div>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ $t('keymap.editor.binding.key.help') }}
        </p>
      </div>

      <!-- Action Type Selector -->
      <div>
        <label class="block text-sm font-medium mb-1">{{ $t('keymap.editor.binding.action') }}</label>
        <el-select v-model="form.action" placeholder="{{ $t('keymap.editor.binding.action.placeholder') }}" size="small" style="width: 100%;">
          <el-option
            v-for="action in actionTypes"
            :key="action.value"
            :label="action.label"
            :value="action.value"
          />
        </el-select>
      </div>

      <!-- Action Parameters -->
      <div v-if="form.action === 'keyevent'">
        <label class="block text-sm font-medium mb-1">{{ $t('keymap.editor.binding.keyevent.code') }}</label>
        <el-select v-model="form.params.code" placeholder="{{ $t('keymap.editor.binding.keyevent.code.placeholder') }}" size="small" style="width: 100%;" filterable>
          <el-option
            v-for="code in keyeventCodes"
            :key="code"
            :label="code"
            :value="code"
          />
        </el-select>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ $t('keymap.editor.binding.keyevent.help') }}
        </p>
      </div>

      <div v-if="form.action === 'tap'">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1">{{ $t('keymap.editor.binding.tap.x') }}</label>
            <el-input-number v-model="form.params.x" :min="0" :max="deviceWidth" size="small" style="width: 100%;" :controls-position="right" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ $t('keymap.editor.binding.tap.y') }}</label>
            <el-input-number v-model="form.params.y" :min="0" :max="deviceHeight" size="small" style="width: 100%;" :controls-position="right" />
          </div>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ $t('keymap.editor.binding.tap.help') }}
        </p>
        <el-button size="small" @click="pickFromCanvas('tap')">
          <el-icon><LocationFilled /></el-icon>
          {{ $t('keymap.editor.binding.tap.pickFromCanvas') }}
        </el-button>
      </div>

      <div v-if="form.action === 'swipe'">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1">{{ $t('keymap.editor.binding.swipe.startX') }}</label>
            <el-input-number v-model="form.params.startX" :min="0" :max="deviceWidth" size="small" style="width: 100%;" :controls-position="right" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ $t('keymap.editor.binding.swipe.startY') }}</label>
            <el-input-number v-model="form.params.startY" :min="0" :max="deviceHeight" size="small" style="width: 100%;" :controls-position="right" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ $t('keymap.editor.binding.swipe.endX') }}</label>
            <el-input-number v-model="form.params.endX" :min="0" :max="deviceWidth" size="small" style="width: 100%;" :controls-position="right" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ $t('keymap.editor.binding.swipe.endY') }}</label>
            <el-input-number v-model="form.params.endY" :min="0" :max="deviceHeight" size="small" style="width: 100%;" :controls-position="right" />
          </div>
        </div>
        <div class="mt-2">
          <label class="block text-sm font-medium mb-1">{{ $t('keymap.editor.binding.swipe.duration') }} (ms)</label>
          <el-input-number v-model="form.params.duration" :min="100" :max="5000" :step="50" size="small" style="width: 100%;" :controls-position="right" />
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ $t('keymap.editor.binding.swipe.help') }}
        </p>
        <el-button size="small" @click="pickFromCanvas('swipe')">
          <el-icon><LocationFilled /></el-icon>
          {{ $t('keymap.editor.binding.swipe.pickFromCanvas') }}
        </el-button>
      </div>

      <div v-if="form.action === 'text'">
        <label class="block text-sm font-medium mb-1">{{ $t('keymap.editor.binding.text.content') }}</label>
        <el-input v-model="form.params.text" type="textarea" :rows="3" placeholder="{{ $t('keymap.editor.binding.text.placeholder') }}" size="small" style="width: 100%;" />
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ $t('keymap.editor.binding.text.help') }}
        </p>
      </div>

      <div v-if="form.action === 'shell'">
        <label class="block text-sm font-medium mb-1">{{ $t('keymap.editor.binding.shell.command') }}</label>
        <el-input v-model="form.params.command" placeholder="{{ $t('keymap.editor.binding.shell.placeholder') }}" size="small" style="width: 100%;" />
        <div class="flex items-center gap-2 mt-2">
          <el-checkbox v-model="form.params.keepOpen" size="small">
            {{ $t('keymap.editor.binding.shell.keepOpen') }}
          </el-checkbox>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ $t('keymap.editor.binding.shell.help') }}
        </p>
      </div>

      <div v-if="form.action === 'macro'">
        <label class="block text-sm font-medium mb-1">{{ $t('keymap.editor.binding.macro.steps') }}</label>
        <div class="space-y-2">
          <div v-for="(step, index) in form.params.steps" :key="step.id" class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <span class="text-gray-500 dark:text-gray-400 text-sm">{{ index + 1 }}.</span>
            <el-select v-model="step.type" size="small" style="width: 120px;" placeholder="Type">
              <el-option label="Keyevent" value="keyevent" />
              <el-option label="Tap" value="tap" />
              <el-option label="Swipe" value="swipe" />
              <el-option label="Text" value="text" />
              <el-option label="Shell" value="shell" />
              <el-option label="Wait" value="wait" />
            </el-select>
            <div v-if="step.type === 'keyevent'" class="flex-1">
              <el-select v-model="step.params.code" size="small" style="width: 100%;" filterable placeholder="Keycode">
                <el-option v-for="code in keyeventCodes" :key="code" :label="code" :value="code" />
              </el-select>
            </div>
            <div v-if="step.type === 'tap'" class="flex-1 flex gap-1">
              <el-input-number v-model="step.params.x" :min="0" :max="deviceWidth" size="small" style="width: 80px;" :controls-position="right" placeholder="X" />
              <el-input-number v-model="step.params.y" :min="0" :max="deviceHeight" size="small" style="width: 80px;" :controls-position="right" placeholder="Y" />
            </div>
            <div v-if="step.type === 'swipe'" class="flex-1 flex gap-1">
              <el-input-number v-model="step.params.startX" :min="0" :max="deviceWidth" size="small" style="width: 60px;" :controls-position="right" placeholder="SX" />
              <el-input-number v-model="step.params.startY" :min="0" :max="deviceHeight" size="small" style="width: 60px;" :controls-position="right" placeholder="SY" />
              <el-input-number v-model="step.params.endX" :min="0" :max="deviceWidth" size="small" style="width: 60px;" :controls-position="right" placeholder="EX" />
              <el-input-number v-model="step.params.endY" :min="0" :max="deviceHeight" size="small" style="width: 60px;" :controls-position="right" placeholder="EY" />
            </div>
            <div v-if="step.type === 'text'" class="flex-1">
              <el-input v-model="step.params.text" size="small" style="width: 100%;" placeholder="Text" />
            </div>
            <div v-if="step.type === 'shell'" class="flex-1">
              <el-input v-model="step.params.command" size="small" style="width: 100%;" placeholder="Command" />
            </div>
            <div v-if="step.type === 'wait'" class="flex-1">
              <el-input-number v-model="step.params.duration" :min="100" :max="10000" :step="100" size="small" style="width: 100%;" :controls-position="right" placeholder="ms" />
            </div>
            <el-button size="small" type="danger" plain @click="removeStep(index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
          <el-button size="small" @click="addStep">
            <el-icon><Plus /></el-icon>
            {{ $t('keymap.editor.binding.macro.addStep') }}
          </el-button>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ $t('keymap.editor.binding.macro.help') }}
        </p>
      </div>

      <!-- Enabled Toggle -->
      <div class="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
        <span>{{ $t('keymap.editor.binding.enabled') }}</span>
        <el-switch v-model="form.enabled" size="small" />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer flex justify-end gap-2">
        <el-button @click="handleClose">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button type="primary" @click="submit">
          {{ $t('common.save') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { KEYEVENT_CODES } from '$renderer/utils/keymap/index.js'

defineProps({
  visible: { type: Boolean, default: false },
  binding: { type: Object, default: null },
  deviceWidth: { type: Number, default: 0 },
  deviceHeight: { type: Number, default: 0 },
  screenshotUrl: { type: String, default: '' },
})

defineEmits(['save', 'close', 'update:visible'])

const form = ref({
  id: '',
  action: 'keyevent',
  params: {},
  enabled: true,
  key: '',
})

const editingIndex = ref(-1)
const waitingForKey = ref(false)
const keyListenerAttached = ref(false)

const keyeventCodes = KEYEVENT_CODES

const actionTypes = [
  { value: 'keyevent', label: $t('keymap.action.keyevent') },
  { value: 'tap', label: $t('keymap.action.tap') },
  { value: 'swipe', label: $t('keymap.action.swipe') },
  { value: 'text', label: $t('keymap.action.text') },
  { value: 'shell', label: $t('keymap.action.shell') },
  { value: 'macro', label: $t('keymap.action.macro') },
]

watch(() => props.visible, (val) => {
  if (val && props.binding) {
    form.value = { ...props.binding }
    editingIndex.value = -1 // This will be set by parent
  }
  else if (!val) {
    resetForm()
  }
})

function resetForm() {
  form.value = {
    id: `binding_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    action: 'keyevent',
    params: {},
    enabled: true,
    key: '',
  }
  waitingForKey.value = false
}

function handleKeyDown(event) {
  if (waitingForKey.value) {
    event.preventDefault()
    event.stopPropagation()
  }
}

function handleKeyUp(event) {
  if (!waitingForKey.value)
    return

  // Convert key to a readable format
  let key = event.key
  if (event.ctrlKey)
    key = `Ctrl+${key}`
  if (event.altKey)
    key = `Alt+${key}`
  if (event.shiftKey)
    key = `Shift+${key}`
  if (event.metaKey)
    key = `Meta+${key}`

  // Normalize special keys
  const keyMap = {
    ' ': 'Space',
    'Escape': 'Esc',
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
    'Control': 'Ctrl',
    'Alt': 'Alt',
    'Shift': 'Shift',
    'Meta': 'Meta',
    'Enter': 'Enter',
    'Tab': 'Tab',
    'Backspace': 'Backspace',
    'Delete': 'Del',
    'Insert': 'Ins',
    'Home': 'Home',
    'End': 'End',
    'PageUp': 'PgUp',
    'PageDown': 'PgDn',
    'CapsLock': 'CapsLock',
    'NumLock': 'NumLock',
    'ScrollLock': 'ScrollLock',
    'PrintScreen': 'PrintScreen',
    'Pause': 'Pause',
    'ContextMenu': 'Menu',
  }
  key = keyMap[key] || key

  // Handle function keys
  if (event.key.startsWith('F') && event.key.length <= 3 && /^F\d+$/.test(event.key)) {
    key = event.key.toUpperCase()
  }

  form.value.key = key
  waitingForKey.value = false
}

function focusKeyInput() {
  waitingForKey.value = true
}

function clearKey() {
  form.value.key = ''
  waitingForKey.value = false
}

function pickFromCanvas(type) {
  emit('close')
  // Parent will handle canvas interaction
  if (type === 'tap') {
    // The parent will call canvasRef.value.startAddTap()
  }
  else if (type === 'swipe') {
    // The parent will call canvasRef.value.startAddSwipe()
  }
}

function addStep() {
  form.value.params.steps = [
    ...(form.value.params.steps || []),
    {
      id: `step_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: 'keyevent',
      params: {},
    },
  ]
}

function removeStep(index) {
  form.value.params.steps = form.value.params.steps.filter((_, i) => i !== index)
}

function submit() {
  // Validate
  if (!form.value.key) {
    ElMessage.warning('请设置按键')
    return
  }

  if (!form.value.action) {
    ElMessage.warning('请选择动作类型')
    return
  }

  // Validate params based on action
  const params = form.value.params
  switch (form.value.action) {
    case 'keyevent':
      if (!params.code) {
        ElMessage.warning('请选择按键码')
        return
      }
      break
    case 'tap':
      if (params.x === undefined || params.y === undefined) {
        ElMessage.warning('请设置点击坐标')
        return
      }
      break
    case 'swipe':
      if (params.startX === undefined || params.startY === undefined || params.endX === undefined || params.endY === undefined) {
        ElMessage.warning('请设置滑动坐标')
        return
      }
      break
    case 'text':
      if (!params.text) {
        ElMessage.warning('请输入文本内容')
        return
      }
      break
    case 'shell':
      if (!params.command) {
        ElMessage.warning('请输入Shell命令')
        return
      }
      break
    case 'macro':
      if (!params.steps?.length) {
        ElMessage.warning('请至少添加一个宏步骤')
        return
      }
      break
  }

  emit('save', { ...form.value })
}

function handleClose() {
  waitingForKey.value = false
  emit('update:visible', false)
  emit('close')
}
</script>

<style scoped lang="postcss">
.binding-form {
  @apply space-y-4;
}
</style>
