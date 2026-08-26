import window from './window.js'

export default {
  name: 'module:logcat',
  order: 100,
  apply(mainApp) {
    mainApp.use(window)
  },
}
