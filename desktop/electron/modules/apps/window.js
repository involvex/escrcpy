import { createWindowManager } from '@escrcpy/electron-setup/main'

export default {
  name: 'module:apps:window',
  apply(mainApp) {
    createWindowManager('pages/apps', {
      singleton: false,
    })
  },
}
