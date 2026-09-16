<template>
  <el-button
    type="primary"
    text
    :disabled="['unauthorized', 'offline'].includes(row.status)"
    :loading="loading"
    :icon="loading ? '' : 'Monitor'"
    :title="loading ? $t('common.starting') : $t('device.mirror.start')"
    @click="handleClick(row)"
  >
  </el-button>
</template>

<script>
import { sleep } from '$/utils'
import { openFloatControl } from '$/utils/device/index.js'
import { isPresetDevice, LATENCY_PRESET_ARGS } from '$/utils/latency-preset/index.js'

export default {
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
  setup() {
    const preferenceStore = usePreferenceStore()
    const deviceStore = useDeviceStore()
    return {
      preferenceStore,
      deviceStore,
    }
  },
  data() {
    return {
      loading: false,
    }
  },
  methods: {
    async handleClick(row = this.row) {
      this.loading = true

      const showControlBar = window.$preload.store.get('common.controlBarOnMirror') !== false

      if (showControlBar) {
        this.toggleRowExpansion(row, true)
      }

      let serial = row.id
      let args = this.preferenceStore.scrcpyParameter(serial, {
        presetArgs: isPresetDevice(serial) ? LATENCY_PRESET_ARGS : null,
      })

      try {
        try {
          serial = await window.$preload.adb.ensureDeviceOnline(row.id)
        }
        catch (readyError) {
          console.warn('mirror.ensureDeviceOnline', readyError?.message || readyError)
        }

        args = this.preferenceStore.scrcpyParameter(serial, {
          presetArgs: isPresetDevice(serial) ? LATENCY_PRESET_ARGS : null,
        })

        const mirroring = this.$scrcpy.mirror(serial, {
          title: this.deviceStore.getLabel({ ...row, id: serial }, 'mirror'),
          args,
          stdout: this.onStdout,
          stderr: this.onStderr,
        })

        await sleep(500)

        this.loading = false

        if (showControlBar) {
          openFloatControl(toRaw({ ...row, id: serial }))
        }

        await mirroring
      }
      catch (error) {
        const message = error?.message || String(error)
        const transient = /closed|offline|not found|adb push|Server connection failed/i.test(message)

        if (transient) {
          try {
            await window.$preload.adb.ensureAdbDaemon?.()
            serial = await window.$preload.adb.ensureDeviceOnline(row.id)
            args = this.preferenceStore.scrcpyParameter(serial, {
              presetArgs: isPresetDevice(serial) ? LATENCY_PRESET_ARGS : null,
            })
            console.warn('mirror.retry', serial)
            await this.$scrcpy.mirror(serial, {
              title: this.deviceStore.getLabel({ ...row, id: serial }, 'mirror'),
              args,
              stdout: this.onStdout,
              stderr: this.onStderr,
            })
            this.loading = false
            return
          }
          catch (retryError) {
            console.error('mirror.retry.error', retryError)
          }
        }

        console.error('mirror.args', args)
        console.error('mirror.error', error)

        if (message) {
          this.$message.warning(message)
        }
      }
      finally {
        this.loading = false
      }
    },

    onStdout() {},
    onStderr() {},
  },
}
</script>

<style></style>
