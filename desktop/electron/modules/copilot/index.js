import service from './service.js'
import window from './window.js'

export default {
  name: 'module:copilot',
  apply(mainApp) {
    mainApp.use(window)
    mainApp.use(service)
  },
}
