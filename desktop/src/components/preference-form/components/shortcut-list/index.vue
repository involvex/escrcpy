<template>
  <div class="space-y-2">
    <div
      v-for="(item, index) in shortcuts"
      :key="index"
      class="flex items-center gap-2"
    >
      <el-input
        v-model="item.accelerator"
        placeholder="Ctrl+D"
        class="!w-40"
        size="small"
        @input="emitChange"
      >
      </el-input>
      <el-select
        v-model="item.keyevent"
        filterable
        allow-create
        default-first-option
        :placeholder="$t('keymap.editor.binding.keyevent.code.placeholder')"
        class="!w-48"
        size="small"
        @change="emitChange"
      >
        <el-option
          v-for="option in keyeventOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-input
        v-model="item.label"
        placeholder="Label"
        class="!w-32"
        size="small"
        @input="emitChange"
      >
      </el-input>
      <el-button
        type="danger"
        icon="Delete"
        circle
        size="small"
        @click="remove(index)"
      >
      </el-button>
    </div>
    <el-button type="primary" plain size="small" @click="add">
      {{ $t('common.add') }}
    </el-button>
  </div>
</template>

<script>
import { getKeyeventLabel, KEYEVENT_LIST } from '$/utils/keymap/index.js'

export default {
  name: 'ShortcutList',
  props: {
    modelValue: {
      type: Array,
      default: () => [],
    },
    data: {
      type: Object,
      default: () => ({}),
    },
    preferenceData: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ['update:model-value'],
  computed: {
    shortcuts: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:model-value', value)
      },
    },
    keyeventOptions() {
      return KEYEVENT_LIST.map(entry => ({
        label: getKeyeventLabel(entry.code),
        value: entry.code,
      }))
    },
  },
  methods: {
    emitChange() {
      this.$emit('update:model-value', this.modelValue)
    },
    add() {
      this.shortcuts = [...this.shortcuts, { accelerator: '', keyevent: '', label: '' }]
    },
    remove(index) {
      this.shortcuts = this.shortcuts.filter((_, i) => i !== index)
    },
  },
}
</script>

<style></style>
