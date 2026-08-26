import pLimit from 'p-limit'
import { defineStore } from 'pinia'
import {
  createSampleRing,
  evaluateBatteryAlerts,
  TELEMETRY_DEFAULTS,
} from '$/utils/device/telemetry/index.js'

const ALERT_COOLDOWN_MS = 10 * 60 * 1000

export const useTelemetryStore = defineStore('app-telemetry', () => {
  const entries = ref({})
  const samples = ref({})
  const polling = ref(false)

  const rings = new Map()
  const notifiedAt = new Map()

  let timer = null
  let inFlight = false

  function ensureRing(deviceId) {
    if (!rings.has(deviceId)) {
      rings.set(deviceId, createSampleRing(TELEMETRY_DEFAULTS.maxSamples))
    }

    return rings.get(deviceId)
  }

  function recordSample(deviceId, battery) {
    entries.value[deviceId] = {
      battery,
      updatedAt: Date.now(),
    }

    ensureRing(deviceId).push({
      level: battery?.batteryPercentage,
      temp: battery?.temperatureCelsius,
    })

    samples.value[deviceId] = rings.get(deviceId).toArray()

    notifyAlerts(deviceId, battery)
  }

  function notifyAlerts(deviceId, battery) {
    const codes = evaluateBatteryAlerts(battery)
    const now = Date.now()

    for (const code of codes) {
      const key = `${deviceId}:${code}`

      if (now - (notifiedAt.get(key) || 0) < ALERT_COOLDOWN_MS) {
        continue
      }

      notifiedAt.set(key, now)

      ElNotification({
        title: window.t('common.danger'),
        message: `${deviceId} · ${code === 'low'
          ? `${battery.batteryPercentage}%`
          : `${battery.temperatureCelsius}℃`}`,
        type: 'warning',
        duration: 6000,
      })
    }

    for (const code of ['low', 'hot']) {
      if (!codes.includes(code)) {
        notifiedAt.delete(`${deviceId}:${code}`)
      }
    }
  }

  async function sampleDevices(deviceIds) {
    if (!deviceIds?.length || inFlight) {
      return
    }

    inFlight = true

    const concurrencyLimit = Number(window.$preload.store.get('common.concurrencyLimit') ?? 5)
    const limit = pLimit(Math.max(1, concurrencyLimit))

    try {
      await Promise.allSettled(
        deviceIds.map(deviceId =>
          limit(async () => {
            try {
              const battery = await window.$preload.adb.battery(deviceId)
              recordSample(deviceId, battery.computed)
            }
            catch {
              // device went away; skip this round
            }
          }),
        ),
      )
    }
    finally {
      inFlight = false
    }
  }

  function tick() {
    const deviceIds = useDeviceStore()
      .list
      .filter(item => ['device', 'emulator'].includes(item.status))
      .map(item => item.id)

    sampleDevices(deviceIds)
  }

  function start({ intervalMs = 15000 } = {}) {
    if (timer) {
      return
    }

    polling.value = true
    tick()
    timer = setInterval(tick, Math.max(5000, intervalMs))
  }

  function stop() {
    polling.value = false

    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function clearDevice(deviceId) {
    rings.delete(deviceId)
    delete entries.value[deviceId]
    delete samples.value[deviceId]
  }

  onScopeDispose(() => stop())

  return {
    clearDevice,
    entries,
    polling,
    sampleDevices,
    samples,
    start,
    stop,
  }
})
