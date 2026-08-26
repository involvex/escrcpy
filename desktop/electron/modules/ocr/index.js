import { registerOcrService } from './service.js'

export default {
  name: 'module:ocr',
  order: 100,
  apply() {
    registerOcrService()
  },
}
