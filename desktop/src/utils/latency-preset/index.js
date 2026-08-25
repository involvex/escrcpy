export const LATENCY_PRESET_ARGS = {
  '--max-size': 1280,
  '--max-fps': 60,
  '--video-bit-rate': '8M',
  '--audio-buffer': 50,
  '--no-clipboard-autosync': true,
}

export function getPresetDevices() {
  return window.$preload.store.get('common.latencyPreset') || []
}

export function isPresetDevice(deviceId) {
  return getPresetDevices().includes(deviceId)
}

export function togglePresetDevice(deviceId) {
  const list = getPresetDevices()
  const enabled = !list.includes(deviceId)
  const value = enabled
    ? [...list, deviceId]
    : list.filter(id => id !== deviceId)

  window.$preload.store.set('common.latencyPreset', value)

  return enabled
}
