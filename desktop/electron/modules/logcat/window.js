import { createWindowManager } from '@escrcpy/electron-setup/main'

export default {
  name: 'module:logcat:window',
  apply(mainApp) {
    createWindowManager('pages/logcat', {
      singleton: false,
    })
  },
}
