/**
 * Copilot task hooks - reactive task history via liveQuery.
 *
 * @module storage/modules/copilot-task
 */

import { CopilotTaskStatus, copilotTaskStore } from './store.js'
import { db } from '$/database/core/database.js'
import { liveQuery } from 'dexie'

/**
 * Reactive list of recent copilot batch tasks (newest first).
 * @param {Object} [options]
 * @param {number} [options.limit]
 */
export function useCopilotTasks(options = {}) {
  const { limit = 200 } = options

  const tasks = shallowRef([])
  const loading = ref(true)

  let subscription = null

  function subscribe() {
    subscription?.unsubscribe?.()

    subscription = liveQuery(async () => {
      const records = await db.copilotTasks.toArray()
      return records.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, limit)
    }).subscribe({
      next(value) {
        tasks.value = value || []
        loading.value = false
      },
      error(error) {
        console.error('[useCopilotTasks] subscribe error:', error)
        loading.value = false
      },
    })
  }

  subscribe()

  onUnmounted(() => {
    subscription?.unsubscribe?.()
    subscription = null
  })

  async function clearFinished() {
    const finished = tasks.value.filter(task =>
      task.status !== CopilotTaskStatus.RUNNING,
    )

    return copilotTaskStore.bulkDelete(finished.map(task => task.id))
  }

  return {
    tasks,
    loading,
    clearFinished,
  }
}
