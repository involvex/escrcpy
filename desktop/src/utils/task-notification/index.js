/**
 * Notify when a long-running task finishes (tray-friendly).
 * Requires preferences.common.taskNotifications.
 */
export function notifyTaskFinished(body, { title } = {}) {
  try {
    if (!window.$preload?.store?.get?.('common.taskNotifications')) {
      return
    }

    window.$preload.ipcRenderer.invoke('task-notify', {
      title: title || window.t('common.success'),
      body: String(body || ''),
    }).catch(() => {})
  }
  catch {
    // Ignore notification failures; in-app toasts remain the primary feedback.
  }
}
