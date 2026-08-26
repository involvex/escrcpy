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
      return db.copilotTasks
        .orderBy('createdAt')
        .reverse()
        .limit(limit)
        .toArray()
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
    const staleIds = await db.copilotTasks
      .where('status')
      .notEqual(CopilotTaskStatus.RUNNING)
      .primaryKeys()

    return copilotTaskStore.bulkDelete(staleIds)
  }

  return {
    tasks,
    loading,
    clearFinished,
  }
}
