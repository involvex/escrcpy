import { ipcMain, Notification } from 'electron'
import electronStore from '$electron/helpers/store/index.js'
import { t } from '$electron/helpers/i18n/index.js'

/**
 * Main-process task notifications (recording, batch jobs, schedules, copilot).
 * Honors common.taskNotifications; no-ops when disabled or unsupported.
 */
export default {
  name: 'service:notifications',
  apply() {
    ipcMain.handle('task-notify', (_event, { title, body } = {}) => {
      if (!electronStore.get('common.taskNotifications')) {
        return false
      }

      if (!Notification.isSupported()) {
        return false
      }

      const notification = new Notification({
        title: title || t('common.success'),
        body: body || '',
      })
      notification.show()
      return true
    })
  },
}
