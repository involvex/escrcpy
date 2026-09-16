<template>
  <el-dialog
    v-model="visible"
    :title="$t('about.donate.title')"
    center
    class="el-dialog--beautify"
    width="480px"
    @closed="onClosed"
  >
    <div class="pt-2 pb-4 text-center space-y-4">
      <p>{{ $t('about.donate.description') }}</p>
      <el-button type="primary" size="large" @click="openSponsors">
        GitHub Sponsors
      </el-button>
      <div>
        <a
          class="text-primary-500 hover:underline"
          href="https://github.com/sponsors/involvex"
          target="_blank"
        >github.com/sponsors/involvex</a>
      </div>
    </div>
  </el-dialog>
</template>

<script>
export default {
  data() {
    return {
      visible: false,
    }
  },
  methods: {
    open() {
      this.visible = true
    },
    close() {
      this.visible = false
    },
    openSponsors() {
      window.open('https://github.com/sponsors/involvex', '_blank')
    },
    submit() {},
    onClosed() {},
  },
}
</script>

<style></style>
