import dayjs from 'dayjs'

const MAX_BUFFER_SIZE = 20000
const BUFFER_SLACK = 2000
const FLUSH_INTERVAL = 200

const PRIORITY_LETTERS = {
  0: '?',
  2: 'V',
  3: 'D',
  4: 'I',
  5: 'W',
  6: 'E',
  7: 'F',
}

const CRASH_PATTERNS = [
  /FATAL EXCEPTION/,
  /ANR in /,
  /Force finishing activity/,
  /beginning of crash/i,
  /\bhas died\b/,
]

const CRASH_TAGS = new Set(['AndroidRuntime', 'ART', 'ActivityManager'])

let sequence = 0

function detectCrash(entry) {
  if (CRASH_TAGS.has(entry.tag)) {
    return true
  }

  if (entry.priority >= 7) {
    return true
  }

  return CRASH_PATTERNS.some(pattern => pattern.test(entry.message))
}

function normalizeEntry(raw) {
  const priority = Number.isInteger(raw.priority) ? raw.priority : 0

  return {
    seq: ++sequence,
    time: dayjs(raw.date).format('HH:mm:ss.SSS'),
    priority,
    level: PRIORITY_LETTERS[priority] || '?',
    tag: String(raw.tag ?? ''),
    pid: raw.pid,
    tid: raw.tid,
    message: String(raw.message ?? ''),
    crash: false,
  }
}

function parsePsOutput(stdout) {
  const pidMap = new Map()

  for (const line of String(stdout ?? '').split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/)

    if (tokens.length < 9) {
      continue
    }

    const pid = Number.parseInt(tokens[1], 10)
    const name = tokens[tokens.length - 1]

    if (!Number.isInteger(pid) || !name || !name.includes('.')) {
      continue
    }

    if (!pidMap.has(name)) {
      pidMap.set(name, new Set())
    }

    pidMap.get(name).add(pid)
  }

  return pidMap
}

/**
 * Logcat streaming session for a device
 * @param {import('vue').Ref<string>} deviceIdRef
 */
export function useLogcat(deviceIdRef) {
  const entries = shallowRef([])
  const connected = ref(false)
  const connecting = ref(false)
  const paused = ref(false)

  const search = ref('')
  const searchDebounced = refDebounced(search, 300)
  const priorities = ref([])
  const tagText = ref('')
  const tagMode = ref('exclude')
  const packageName = ref('')
  const pidMap = shallowRef(new Map())

  let buffer = []
  let pending = []
  let flushTimer = null

  function scheduleFlush() {
    if (flushTimer) {
      return
    }

    flushTimer = setTimeout(() => {
      flushTimer = null
      flush()
    }, FLUSH_INTERVAL)
  }

  function flush(force = false) {
    if (pending.length) {
      buffer.push(...pending.splice(0))
    }

    if (buffer.length > MAX_BUFFER_SIZE + BUFFER_SLACK) {
      buffer = buffer.slice(-MAX_BUFFER_SIZE)
    }

    // While paused the view stays frozen, but the buffer is still
    // consumed and trimmed to keep memory bounded
    if (force || !paused.value) {
      entries.value = buffer.slice()
    }
  }

  function handleEntry(raw) {
    const entry = normalizeEntry(raw)
    entry.crash = detectCrash(entry)
    pending.push(entry)
    scheduleFlush()
  }

  async function connect({ clear = false } = {}) {
    if (!deviceIdRef.value || connecting.value || connected.value) {
      return
    }

    connecting.value = true

    try {
      await window.$preload.adb.openLogcat(deviceIdRef.value, {
        clear,
        onEntry: handleEntry,
        onEnd: () => {
          connected.value = false
        },
        onError: () => {
          connected.value = false
        },
      })

      connected.value = true
      flush()

      refreshPidMap()
    }
    catch (error) {
      console.warn('openLogcat failed:', error?.message || error)
      ElMessage.error(`${window.t('common.failed')}: ${error?.message || error}`)
    }
    finally {
      connecting.value = false
    }
  }

  function disconnect() {
    window.$preload.adb.closeLogcat(deviceIdRef.value)
    connected.value = false
  }

  async function clear() {
    buffer = []
    pending = []
    flush(true)

    try {
      await window.$preload.adb.deviceShell(deviceIdRef.value, 'logcat -c')
    }
    catch (error) {
      console.warn('logcat clear failed:', error?.message || error)
    }
  }

  function togglePause() {
    paused.value = !paused.value

    if (!paused.value) {
      flush()
    }
  }

  async function refreshPidMap() {
    try {
      const stdout = await window.$preload.adb.deviceShell(deviceIdRef.value, 'ps -A')
      pidMap.value = parsePsOutput(stdout)
    }
    catch (error) {
      console.warn('ps -A failed:', error?.message || error)
    }
  }

  function formatEntry(entry) {
    return `${entry.time} ${entry.level}/${entry.tag}(${entry.pid}): ${entry.message}`
  }

  const filteredTagList = computed(() => {
    return tagText.value
      .split(/[,\s]+/)
      .map(tag => tag.trim())
      .filter(Boolean)
  })

  const filteredEntries = computed(() => {
    let list = entries.value

    const selectedPriorities = priorities.value

    if (selectedPriorities.length) {
      list = list.filter(entry => selectedPriorities.includes(entry.priority))
    }

    const keyword = searchDebounced.value.trim().toLowerCase()

    if (keyword) {
      list = list.filter(entry =>
        entry.message.toLowerCase().includes(keyword)
        || entry.tag.toLowerCase().includes(keyword),
      )
    }

    const tags = filteredTagList.value

    if (tags.length) {
      if (tagMode.value === 'include') {
        list = list.filter(entry => tags.includes(entry.tag))
      }
      else {
        list = list.filter(entry => !tags.includes(entry.tag))
      }
    }

    const pkg = packageName.value

    if (pkg) {
      const pids = pidMap.value.get(pkg)

      list = list.filter(entry =>
        pids?.has(entry.pid) || entry.message.includes(pkg),
      )
    }

    return list
  })

  const crashCount = computed(() => {
    return filteredEntries.value.reduce((count, entry) => {
      return entry.crash ? count + 1 : count
    }, 0)
  })

  const firstCrashIndex = computed(() => {
    return filteredEntries.value.findIndex(entry => entry.crash)
  })

  const collectedCount = computed(() => entries.value.length)

  function exportLog() {
    const content = filteredEntries.value.map(formatEntry).join('\n')

    if (!content) {
      ElMessage.warning(window.t('logcat.export.empty'))
      return
    }

    const fileName = `logcat-${deviceIdRef.value}-${dayjs().format('YYYY-MM-DD-HH-mm-ss')}.log`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()

    URL.revokeObjectURL(url)

    ElMessage.success(window.t('logcat.export.success'))
  }

  function teardown() {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }

    disconnect()
  }

  // Vue teardown does not run when the window itself closes,
  // so listen for the native unload event as well
  window.addEventListener('beforeunload', teardown)

  onUnmounted(() => {
    window.removeEventListener('beforeunload', teardown)
    teardown()
  })

  return {
    entries,
    connected,
    connecting,
    paused,
    search,
    priorities,
    tagText,
    tagMode,
    packageName,
    pidMap,
    filteredEntries,
    crashCount,
    firstCrashIndex,
    collectedCount,
    connect,
    disconnect,
    clear,
    togglePause,
    refreshPidMap,
    exportLog,
  }
}

export default useLogcat
