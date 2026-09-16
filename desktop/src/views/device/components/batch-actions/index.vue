<template>
  <Scrollable>
    <el-button-group class="flex items-center">
      <component
        :is="item.component"
        v-for="(item, index) in actionModel"
        :key="index"
        class="flex-none"
        v-bind="{
          devices,
          ...(item.command
            ? {
              onClick: () => handleShell(item),
            }
            : {}),
        }"
      >
        <template #default="{ loading = false, trigger }">
          <el-button
            plain
            :title="$t(item.tips || item.label)"
            :loading="loading"
            v-bind="{
              ...(trigger ? {
                onClick: () => trigger(devices),
              } : {}),
            }"
          >
            <template #icon>
              <el-icon v-if="item.elIcon" :class="item.iconClass">
                <component :is="item.elIcon" />
              </el-icon>
              <i v-else-if="item.fontIcon" :class="item.fontIcon"></i>
            </template>
          </el-button>
        </template>
      </component>
    </el-button-group>
  </Scrollable>

  <AutomationListener />
</template>

<script setup>
import Mirror from './mirror/index.vue'
import Application from './application/index.vue'
import Copilot from './copilot/index.vue'
import FilePush from './file-push/index.vue'
import Screenshot from './screenshot/index.vue'
import Schedule from './schedule/index.vue'
import Delete from './delete/index.vue'
import AutomationListener from './automation/index.vue'

const props = defineProps({
  devices: {
    type: Array,
    default: () => [],
  },
})

const actionModel = [
  {
    label: 'device.mirror.start',
    elIcon: 'Monitor',
    component: Mirror,
  },
  {
    label: 'device.remove',
    elIcon: 'Delete',
    component: Delete,
  },
  {
    label: 'device.control.capture',
    elIcon: 'Camera',
    component: Screenshot,
  },
  {
    label: 'device.control.install',
    elIcon: 'Upload',
    component: Application,
  },
  {
    label: 'device.control.file.push',
    elIcon: 'Folder',
    component: FilePush,
  },
  {
    label: 'device.control.copilot',
    elIcon: 'Cpu',
    component: Copilot,
  },
  {
    label: 'device.schedule.name',
    elIcon: 'Clock',
    component: Schedule,
  },
]
</script>

<style></style>
