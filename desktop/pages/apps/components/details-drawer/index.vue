<script setup>
import { formatSize } from '$/hooks/useApps/index.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  item: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:visible'])

const totalSize = computed(() => {
  const item = props.item

  if (!item) {
    return ''
  }

  let total = typeof item.size === 'number' ? item.size : 0

  for (const split of item.splits || []) {
    if (typeof split.size === 'number') {
      total += split.size
    }
  }

  return formatSize(total)
})

function handleClose() {
  emit('update:visible', false)
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    :title="$t('apps.details.title')"
    size="420px"
    @update:model-value="emit('update:visible', $event)"
    @close="handleClose"
  >
    <div v-if="item" class="flex flex-col gap-4 text-sm">
      <div class="text-base font-bold break-all">
        {{ item.name }}
      </div>

      <div class="grid grid-cols-[100px_1fr] gap-y-2 gap-x-2">
        <span class="opacity-60">{{ $t('apps.table.version') }}</span>
        <span>{{ item.versionName || '-' }}<template v-if="item.versionCode"> ({{ item.versionCode }})</template></span>

        <span class="opacity-60">{{ $t('apps.table.type') }}</span>
        <span>{{ $t(item.system ? 'apps.type.system' : 'apps.type.user') }}</span>

        <span class="opacity-60">{{ $t('apps.table.size') }}</span>
        <span>{{ totalSize || '-' }}<template v-if="item.splits?.length"> ({{ $t('apps.details.splits', { count: item.splits.length }) }})</template></span>

        <span class="opacity-60">{{ $t('apps.details.installedAt') }}</span>
        <span>{{ item.firstInstallTime || '-' }}</span>

        <span class="opacity-60">{{ $t('apps.details.updatedAt') }}</span>
        <span>{{ item.lastUpdateTime || '-' }}</span>

        <span class="opacity-60">{{ $t('apps.details.installer') }}</span>
        <span>{{ item.installerPackageName || '-' }}</span>

        <span class="opacity-60">{{ $t('apps.details.path') }}</span>
        <span class="break-all font-mono text-xs">{{ item.apkPath }}</span>
      </div>

      <div v-if="item.permissions?.length">
        <div class="font-bold mb-2">
          {{ $t('apps.details.permissions') }} ({{ item.permissions.length }})
        </div>

        <div class="max-h-64 overflow-auto rounded bg-gray-50 dark:bg-gray-800 p-2">
          <div
            v-for="permission of item.permissions"
            :key="permission"
            class="font-mono text-xs leading-5 break-all"
          >
            {{ permission }}
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped></style>
