<script setup>
import { formatSize } from '$/hooks/useApps/index.js'
import AppEmpty from '$/components/app-empty/index.vue'

defineProps({
  packages: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['selection-change', 'launch', 'uninstall', 'toggle-enabled', 'extract', 'details'])

function versionText(row) {
  if (!row.versionName) {
    return ''
  }

  return row.versionCode
    ? `${row.versionName} (${row.versionCode})`
    : row.versionName
}

function updatedText(row) {
  return row.lastUpdateTime || row.firstInstallTime || ''
}

function handleCommand(command, row) {
  emit(command, row)
}
</script>

<template>
  <el-table
    v-loading="loading"
    :data="packages"
    row-key="name"
    height="100%"
    class="el-table--beautify"
    :element-loading-text="$t('common.loading')"
    @selection-change="values => emit('selection-change', values)"
  >
    <template #empty>
      <AppEmpty v-show="!loading" :sub-title="$t('common.empty')"></AppEmpty>
    </template>

    <el-table-column type="selection" reserve-selection width="40" align="left" />

    <el-table-column
      prop="name"
      :label="$t('apps.table.package')"
      sortable
      show-overflow-tooltip
      align="left"
      min-width="240"
    >
      <template #default="{ row }">
        <span class="cursor-pointer hover:text-primary-500" @click.stop="handleCommand('details', row)">
          {{ row.name }}
        </span>
      </template>
    </el-table-column>

    <el-table-column
      :label="$t('apps.table.version')"
      sortable
      sort-by="versionName"
      show-overflow-tooltip
      align="left"
      min-width="120"
    >
      <template #default="{ row }">
        {{ versionText(row) }}
      </template>
    </el-table-column>

    <el-table-column
      :label="$t('apps.table.type')"
      sortable
      sort-by="system"
      align="left"
      width="100"
    >
      <template #default="{ row }">
        <el-tag size="small" :type="row.system ? 'warning' : 'success'">
          {{ $t(row.system ? 'apps.type.system' : 'apps.type.user') }}
        </el-tag>
      </template>
    </el-table-column>

    <el-table-column
      :label="$t('apps.table.size')"
      sortable
      sort-by="size"
      align="left"
      width="100"
    >
      <template #default="{ row }">
        {{ formatSize(row.size) }}
      </template>
    </el-table-column>

    <el-table-column
      :label="$t('apps.table.updated')"
      sortable
      sort-by="lastUpdateTime"
      show-overflow-tooltip
      align="left"
      min-width="150"
    >
      <template #default="{ row }">
        {{ updatedText(row) }}
      </template>
    </el-table-column>

    <el-table-column
      :label="$t('common.actions')"
      align="left"
      width="220"
    >
      <template #default="{ row }">
        <el-tooltip :content="$t('apps.actions.launch')">
          <el-button text type="primary" icon="VideoPlay" circle @click.stop="handleCommand('launch', row)" />
        </el-tooltip>

        <el-tooltip :content="$t('apps.actions.extract')">
          <el-button text type="primary" icon="Download" circle @click.stop="handleCommand('extract', row)" />
        </el-tooltip>

        <el-tooltip :content="$t(row.disabled ? 'apps.actions.enable' : 'apps.actions.disable')">
          <el-button
            text
            :type="row.disabled ? 'success' : 'warning'"
            :icon="row.disabled ? 'CircleCheck' : 'CircleClose'"
            circle
            @click.stop="handleCommand('toggle-enabled', row)"
          />
        </el-tooltip>

        <el-tooltip :content="$t('apps.actions.uninstall')">
          <el-button text type="danger" icon="Delete" circle @click.stop="handleCommand('uninstall', row)" />
        </el-tooltip>

        <el-tooltip :content="$t('apps.actions.details')">
          <el-button text type="info" icon="InfoFilled" circle @click.stop="handleCommand('details', row)" />
        </el-tooltip>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped></style>
