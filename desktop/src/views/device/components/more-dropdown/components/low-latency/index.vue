<template>
  <slot :loading="loading" :trigger="handleClick" :active="active" />
</template>

<script>
import { isPresetDevice, togglePresetDevice } from '$/utils/latency-preset/index.js'

export default {
  inheritAttrs: false,
  props: {
    row: {
      type: Object,
      default: () => ({}),
    },
    toggleRowExpansion: {
      type: Function,
      default: () => () => false,
    },
  },
  data() {
    return {
      loading: false,
      active: false,
    }
  },
  created() {
    this.active = isPresetDevice(this.row?.id)
  },
  methods: {
    handleClick() {
      const row = this.row

      if (!row?.id) {
        return false
      }

      this.active = togglePresetDevice(row.id)

      this.$message({
        type: 'success',
        grouping: true,
        message: this.$t(this.active
          ? 'device.actions.more.lowLatency.enabled'
          : 'device.actions.more.lowLatency.disabled'),
      })
    },
  },
}
</script>

<style></style>
