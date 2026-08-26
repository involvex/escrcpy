<template>
  <el-dialog
    v-model="visible"
    :title="$t('copilot.history.name')"
    width="720px"
    append-to-body
  >
    <el-table
      v-loading="loading"
      :data="tasks"
      max-height="440"
      size="small"
    >
      <el-table-column :label="$t('common.createTime')" width="100">
        <template #default="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
      </el-table-column>

      <el-table-column
        :label="$t('copilot.history.prompt')"
        min-width="220"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ row.prompt }}
        </template>
      </el-table-column>

      <el-table-column :label="$t('copilot.history.devices')" width="90" align="center">
        <template #default="{ row }">
          {{ `${row.succeeded ?? 0}/${row.total ?? 0}` }}
        </template>
      </el-table-column>

      <el-table-column :label="$t('copilot.history.result')" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="tagType(row.status)" size="small">
            {{ statusLabel(row) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="$t('copilot.history.duration')" width="80" align="right">
        <template #default="{ row }">
          {{ formatDuration(row.durationMs) }}
        </template>
      </el-table-column>

      <el-table-column width="70" align="right">
        <template #default="{ row }">
          <el-button
            text
            icon="RefreshRight"
            :disabled="!row.prompt"
            :title="$t('copilot.history.rerun')"
            @click="handleRerun(row)"
          />
        </template>
      </el-table-column>
    </el-table>

    <div
      v-if="!tasks.length && !loading"
      class="text-center text-gray-400 py-8"
    >
      {{ $t('copilot.history.empty') }}
    </div>
  </el-dialog>
</template>

<script setup>
import dayjs from 'dayjs'
import { CopilotTaskStatus, useCopilotTasks } from '$/database/index.js'

const emit = defineEmits(['rerun'])

const visible = ref(false)

const { tasks, loading } = useCopilotTasks()

function open() {
  visible.value = true
}

function close() {
  visible.value = false
}

function handleRerun(row) {
  if (!row?.prompt) {
    return
  }

  visible.value = false
  emit('rerun', row)
}

defineExpose({
  open,
  close,
})

function formatTime(ts) {
  return ts ? dayjs(ts).format('MM-DD HH:mm') : '-'
}

function formatDuration(durationMs) {
  if (!durationMs && durationMs !== 0) {
    return '-'
  }

  return durationMs >= 1000
    ? `${Math.round(durationMs / 1000)}s`
    : `${durationMs}ms`
}

function tagType(status) {
  switch (status) {
    case CopilotTaskStatus.COMPLETED:
      return 'success'
    case CopilotTaskStatus.PARTIAL:
      return 'warning'
    case CopilotTaskStatus.RUNNING:
      return 'primary'
    default:
      return 'danger'
  }
}

function statusLabel(task) {
  switch (task?.status) {
    case CopilotTaskStatus.RUNNING:
      return window.t('copilot.taskStatus.running')
    case CopilotTaskStatus.PARTIAL:
      return `${task.succeeded}/${task.total}`
    case CopilotTaskStatus.COMPLETED:
      return window.t('common.finished')
    default:
      return window.t('common.failed')
  }
}
</script>

<style lang="postcss" scoped></style>
