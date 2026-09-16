import { isEqual } from 'lodash-es'
import { clonePlainValue } from '$/utils/index.js'

/** Preferred early placement so terminal/logcat are visible without scrolling. */
const PRIORITY_BAR_KEYS = ['terminal', 'logcat']

function migrateBarLayout(layout = []) {
  const next = Array.isArray(layout) ? [...layout] : []

  for (const key of [...PRIORITY_BAR_KEYS].reverse()) {
    const existingIndex = next.indexOf(key)
    if (existingIndex !== -1) {
      next.splice(existingIndex, 1)
    }
    next.unshift(key)
  }

  return next
}

export const useControlStore = defineStore('app-control', () => {
  const barLayout = ref([])

  const swapyKey = ref('')

  function getBarLayout() {
    const stored = window.$preload.store.get('control.barLayout') || []
    const migratedFlag = window.$preload.store.get('control.barLayoutMigratedV1')
    let next = Array.isArray(stored) ? stored : []

    if (!migratedFlag) {
      next = migrateBarLayout(next)
      window.$preload.store.set('control.barLayout', next)
      window.$preload.store.set('control.barLayoutMigratedV1', true)
    }

    barLayout.value = next
    return barLayout.value
  }

  function setBarLayout(value) {
    if (!Array.isArray(value)) {
      throw new TypeError('parameter must be an array')
    }

    if (isEqual(value, barLayout.value)) {
      return false
    }

    barLayout.value = value

    updateSwapyKey()

    window.$preload.store.set('control.barLayout', clonePlainValue(value))
  }

  function setupWatcher() {
    window.$preload.store.onDidChange('control.barLayout', () => {
      getBarLayout()
    })
  }

  async function updateSwapyKey() {
    await nextTick()
    swapyKey.value = barLayout.value.join()
  }

  getBarLayout()
  updateSwapyKey()
  setupWatcher()

  return {
    barLayout,
    swapyKey,
    getBarLayout,
    setBarLayout,
  }
})
