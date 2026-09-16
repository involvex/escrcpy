<template>
  <el-input
    class="!w-full"
    v-bind="{
      type: 'number',
      clearable: true,
      ...(data.props || {}),
    }"
    @update:model-value="onUpdate"
  >
    <template v-if="data.append" #append>
      {{ data.append }}
    </template>
  </el-input>
</template>

<script>
export default {
  props: {
    data: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ['update:model-value'],
  methods: {
    onUpdate(val) {
      // Empty/cleared must stay unset — Number('') === 0 and would force
      // flags like --screen-off-timeout=0 (immediate screen off).
      if (val === '' || val === null || typeof val === 'undefined') {
        this.$emit('update:model-value', undefined)
        return
      }

      const next = typeof val === 'number' ? val : Number(val)
      this.$emit('update:model-value', Number.isFinite(next) ? next : undefined)
    },
  },
}
</script>

<style></style>
