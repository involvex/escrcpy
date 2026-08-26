function formatSize(bytes) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) {
    return ''
  }

  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = -1

  do {
    value /= 1024
    unitIndex++
  } while (value >= 1024 && unitIndex < units.length - 1)

  return `${value.toFixed(1)} ${units[unitIndex]}`
}

function getSplitPaths(item) {
  const separatorIndex = item.apkPath.lastIndexOf('/')
  const dir = separatorIndex > 0 ? item.apkPath.slice(0, separatorIndex) : ''

  return (item.splits || [])
    .map(split => typeof split === 'string' ? split : `${dir}/${split.name}`)
    .filter(Boolean)
}

/**
 * Installed applications manager for a device
 * @param {import('vue').Ref<string>} deviceIdRef
 */
export function useApps(deviceIdRef) {
  const packages = shallowRef([])
  const loading = ref(false)

  const search = ref('')
  const searchDebounced = refDebounced(search, 300)
  const typeFilter = ref('all')
  const statusFilter = ref('all')
  const selection = ref([])

  const detailsVisible = ref(false)
  const detailsPackage = ref(null)

  async function load() {
    if (!deviceIdRef.value) {
      return
    }

    loading.value = true

    try {
      const list = await window.$preload.adb.listPackages(deviceIdRef.value)

      const [infoMap, sizeMap] = await Promise.all([
        window.$preload.adb.getPackagesInfo(deviceIdRef.value).catch((error) => {
          console.warn('getPackagesInfo failed:', error?.message || error)
          return {}
        }),
        window.$preload.adb.getPackagesSizes(deviceIdRef.value, list).catch((error) => {
          console.warn('getPackagesSizes failed:', error?.message || error)
          return {}
        }),
      ])

      packages.value = list.map(item => ({
        ...item,
        ...(infoMap[item.name] || {}),
        ...(sizeMap[item.name] || {}),
        sizeText: formatSize(sizeMap[item.name]?.size),
      }))
    }
    finally {
      loading.value = false
    }
  }

  const filteredPackages = computed(() => {
    let list = packages.value

    const keyword = searchDebounced.value.trim().toLowerCase()

    if (keyword) {
      list = list.filter(item =>
        item.name.toLowerCase().includes(keyword)
        || (item.versionName || '').toLowerCase().includes(keyword),
      )
    }

    if (typeFilter.value !== 'all') {
      const isSystem = typeFilter.value === 'system'
      list = list.filter(item => item.system === isSystem)
    }

    if (statusFilter.value !== 'all') {
      const isDisabled = statusFilter.value === 'disabled'
      list = list.filter(item => item.disabled === isDisabled)
    }

    return list
  })

  async function launch(item) {
    try {
      await window.$preload.adb.launchPackage(deviceIdRef.value, item.name)
      ElMessage.success(window.t('apps.launch.success'))
    }
    catch (error) {
      ElMessage.error(`${window.t('apps.launch.error')}: ${error?.message || error}`)
    }
  }

  async function uninstall(items) {
    const list = Array.isArray(items) ? items : [items]

    if (!list.length) {
      return
    }

    const hasSystem = list.some(item => item.system)
    const names = list.map(item => item.name).join(', ')

    try {
      if (hasSystem) {
        await ElMessageBox.confirm(
          window.t('apps.uninstall.systemConfirm', { count: list.length }),
          window.t('common.tips'),
          { type: 'warning' },
        )
      }
      else {
        await ElMessageBox.confirm(
          window.t('apps.uninstall.confirm', { name: names }),
          window.t('common.tips'),
          { type: 'warning' },
        )
      }
    }
    catch {
      return
    }

    const failed = []

    if (list.length === 1) {
      const item = list[0]

      try {
        if (item.system) {
          await window.$preload.adb.uninstallSystemForUser(deviceIdRef.value, item.name)
        }
        else {
          await window.$preload.adb.uninstall(deviceIdRef.value, item.name)
        }
      }
      catch (error) {
        failed.push(`${item.name}: ${error?.message || error}`)
      }
    }
    else {
      const concurrencyLimit = Number(window.$preload.store.get('common.concurrencyLimit') ?? 10)
      const queue = [...list]
      const workers = Array.from({ length: Math.min(concurrencyLimit, queue.length) }, async () => {
        while (queue.length) {
          const item = queue.shift()

          try {
            if (item.system) {
              await window.$preload.adb.uninstallSystemForUser(deviceIdRef.value, item.name)
            }
            else {
              await window.$preload.adb.uninstall(deviceIdRef.value, item.name)
            }
          }
          catch (error) {
            failed.push(`${item.name}: ${error?.message || error}`)
          }
        }
      })

      await Promise.all(workers)
    }

    if (!failed.length) {
      ElMessage.success(window.t('common.success'))
    }
    else {
      ElMessage.error(
        `${window.t('common.failed')} (${failed.length}):\n${failed.join('\n')}`,
      )
    }

    await load()
  }

  async function toggleEnabled(item) {
    try {
      const command = item.disabled ? 'enable' : 'disable'

      await window.$preload.adb.deviceShell(
        deviceIdRef.value,
        `pm ${command} ${item.name}`,
      )

      item.disabled = !item.disabled

      // packages is a shallowRef, replace the array to trigger re-render
      packages.value = [...packages.value]

      ElMessage.success(window.t(item.disabled ? 'apps.disable.success' : 'apps.enable.success'))
    }
    catch (error) {
      ElMessage.error(`${window.t('common.failed')}: ${error?.stderr || error?.message || error}`)
    }
  }

  async function extract(items) {
    const list = Array.isArray(items) ? items : [items]

    if (!list.length) {
      return
    }

    let folders = []

    try {
      folders = await window.$preload.ipcRenderer.invoke('show-open-dialog', {
        properties: ['openDirectory'],
      })
    }
    catch (error) {
      console.warn(error.message)
      return
    }

    const savePath = folders?.[0]

    if (!savePath) {
      return
    }

    const closeLoading = ElMessage.loading(window.t('apps.extract.progress')).close

    let totalFiles = 0
    let successFiles = 0
    const errors = []

    for (const item of list) {
      const apks = [item.apkPath, ...getSplitPaths(item)]

      for (const remotePath of apks.filter(Boolean)) {
        totalFiles++

        try {
          await window.$preload.adb.pull(deviceIdRef.value, remotePath, { savePath })
          successFiles++
        }
        catch (error) {
          errors.push(`${remotePath}: ${error?.message || error}`)
        }
      }
    }

    closeLoading()

    if (!errors.length) {
      ElMessage.success(window.t('apps.extract.success', { count: successFiles }))
    }
    else {
      ElMessage.warning(
        `${window.t('apps.extract.partial', { success: successFiles, total: totalFiles })}\n${errors.join('\n')}`,
      )
    }
  }

  function openDetails(item) {
    detailsPackage.value = item
    detailsVisible.value = true
  }

  onUnmounted(() => {
    packages.value = []
    selection.value = []
  })

  return {
    packages,
    loading,
    search,
    typeFilter,
    statusFilter,
    selection,
    filteredPackages,
    detailsVisible,
    detailsPackage,
    load,
    launch,
    uninstall,
    toggleEnabled,
    extract,
    openDetails,
    formatSize,
  }
}

export { formatSize }
export default useApps
