import window from './window.js'

export default {
  name: 'module:apps',
  order: 100,
  apply(mainApp) {
    mainApp.use(window)
  },
}
