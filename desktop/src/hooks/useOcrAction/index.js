/**
 * OCR text extraction for a device:
 * screencap → crop dialog → canvas crop → main-process tesseract → result dialog
 * Render <OcrDialog> yourself and bind the returned state.
 * @param {import('vue').Ref<string>} deviceIdRef
 */
export function useOcrAction(deviceIdRef) {
  const loading = ref(false)
  const dialogVisible = ref(false)
  const dialogMode = ref('crop')
  const imageSrc = ref('')
  const busy = ref(false)
  const text = ref('')

  let imageUrl = ''

  function releaseImage() {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl)
      imageUrl = ''
    }
  }

  async function invoke() {
    if (loading.value || !deviceIdRef.value) {
      return
    }

    loading.value = true

    try {
      const base64 = await window.$preload.adb.screencap(
        deviceIdRef.value,
        { returnBase64: true },
      )

      releaseImage()
      imageUrl = URL.createObjectURL(dataUrlToBlob(base64))
      imageSrc.value = imageUrl

      text.value = ''
      dialogMode.value = 'crop'
      dialogVisible.value = true
    }
    catch (error) {
      ElMessage.warning(error?.message || error)
    }
    finally {
      loading.value = false
    }
  }

  async function handleConfirm({ x, y, width, height }) {
    busy.value = true

    try {
      const croppedBase64 = await cropImage(imageUrl, { x, y, width, height })

      const { text: recognized } = await window.$preload.ipcRenderer.invoke('ocr:recognize', {
        imageBase64: croppedBase64,
      })

      const trimmed = String(recognized ?? '').trim()

      if (!trimmed) {
        ElMessage.warning(window.t('ocr.empty'))
        return
      }

      text.value = trimmed
      dialogMode.value = 'result'
    }
    catch (error) {
      console.warn('ocr failed:', error?.message || error)
      ElMessage.error(`${window.t('common.failed')}: ${error?.message || error}`)
    }
    finally {
      busy.value = false
    }
  }

  async function handleCopy(value) {
    await window.$preload.ipcRenderer.invoke('copy-text-to-clipboard', value)

    ElMessage.success(window.t('ocr.copied'))

    dialogVisible.value = false
  }

  function handleClose() {
    releaseImage()
  }

  onUnmounted(() => {
    releaseImage()
  })

  return {
    loading,
    dialogVisible,
    dialogMode,
    imageSrc,
    busy,
    text,
    invoke,
    handleConfirm,
    handleCopy,
    handleClose,
  }
}

function dataUrlToBlob(base64) {
  const value = String(base64 ?? '').replace(/^data:image\/(\w+);base64,/, '')
  const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0))

  return new Blob([bytes], { type: 'image/png' })
}

function cropImage(url, { x, y, width, height }) {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')

        canvas.width = Math.max(1, Math.min(width, image.naturalWidth - x))
        canvas.height = Math.max(1, Math.min(height, image.naturalHeight - y))

        const context = canvas.getContext('2d')

        context.drawImage(image, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)

        resolve(canvas.toDataURL('image/png'))
      }
      catch (error) {
        reject(error)
      }
    }

    image.onerror = () => reject(new Error('Failed to load screenshot for cropping'))
    image.src = url
  })
}

export default useOcrAction
