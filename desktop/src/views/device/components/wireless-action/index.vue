<template>
  <el-button
    v-if="!row.wifi"
    type="primary"
    text
    :loading="connectLoading"
    :disabled="['unauthorized', 'offline'].includes(row.status)"
    :title="connectLoading
      ? $t('device.wireless.connect.progress')
      : $t('device.wireless.mode')"
    @click="handleWifi(row)"
  >
    <template #icon>
      <i class="i-bi-wifi"></i>
    </template>
  </el-button>

  <el-button
    v-if="row.wifi"
    type="danger"
    text
    :loading="stopLoading"
    :disabled="['unauthorized', 'offline'].includes(row.status)"
    :icon="stopLoading ? '' : 'Close'"
    :title="stopLoading
      ? $t('device.wireless.disconnect.progress')
      : $t('device.wireless.disconnect.start')"
    @click="handleStop(row)"
  >
  </el-button>
</template>

<script>
import { sleep } from '$/utils'

export default {
  inheritAttrs: false,
  props: {
    row: {
      type: Object,
      default: () => ({}),
    },
    handleConnect: {
      type: Function,
      default: () => () => false,
    },
    handleRefresh: {
      type: Function,
      default: () => () => false,
    },
  },
  data() {
    return {
      connectLoading: false,
      stopLoading: false,
    }
  },
  methods: {
    async handleWifi(row) {
      this.connectLoading = true
      try {
        const host = await this.$adb.getDeviceIP(row.id)

        if (!host) {
          throw new Error(this.$t('device.wireless.mode.error'))
        }

        const port = await this.$adb.tcpip(row.id, 5555)

        await sleep()

        this.handleConnect(`${host}:${port}`)
      }
      catch (error) {
        console.warn(error.message)
        if (error?.message || error?.cause?.message) {
          this.$message.warning(error?.message || error?.cause?.message)
        }
      }
      finally {
        this.connectLoading = false
      }
    },

    async handleStop(row) {
      this.stopLoading = true

      try {
        await this.$adb.disconnect(row.id)
        await sleep()
        this.$message.success(this.$t('device.wireless.disconnect.success'))
      }
      catch (error) {
        if (error.message)
          this.$message.warning(error.message)
      }

      this.handleRefresh()

      this.stopLoading = false
    },
  },
}
</script>

<style></style>
