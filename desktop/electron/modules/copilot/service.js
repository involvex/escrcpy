import { ipcxMain } from '@escrcpy/electron-ipcx/main'

import {
  copilotService,
  createChannel,
  createOrGetAgent,
} from './helpers/index.js'

export default {
  name: 'module:copilot:service',
  apply(mainApp) {
    ipcxMain.handle(
      createChannel('execute'),
      async (_event, task, options = {}) => {
        return copilotService.execute(task, options)
      },
    )

    ipcxMain.handle(createChannel('stop'), async (_, deviceId, reason) => {
      return copilotService.stop(deviceId, reason)
    })

    ipcxMain.handle(createChannel('destroy'), async (_, deviceId) => {
      return copilotService.destroy(deviceId)
    })

    ipcxMain.handle(createChannel('destroyAll'), async () => {
      return copilotService.destroyAll()
    })

    ipcxMain.handle(
      createChannel('getSessionByDevice'),
      async (_, deviceId) => {
        return copilotService.getSessionByDevice(deviceId)
      },
    )

    ipcxMain.handle(createChannel('getActiveSessions'), async () => {
      return copilotService.getActiveSessions()
    })

    ipcxMain.handle(createChannel('checkModelApi'), async (_, config) => {
      const agent = await createOrGetAgent({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
      })

      return await agent.checkModelApi()
    })

    ipcxMain.handle(createChannel('listModels'), async (_, config = {}) => {
      try {
        const baseUrl = String(config.baseUrl || '').replace(/\/+$/, '')
        const apiKey = config.apiKey || ''

        if (!baseUrl) {
          return { success: false, models: [], message: 'Base URL is required' }
        }

        const headers = {
          Accept: 'application/json',
        }

        if (apiKey) {
          headers.Authorization = `Bearer ${apiKey}`
        }

        if (/openrouter\.ai/i.test(baseUrl)) {
          headers['HTTP-Referer'] = 'https://github.com/involvex/escrcpy'
          headers['X-Title'] = 'Escrcpy Copilot'
        }

        const response = await fetch(`${baseUrl}/models`, { headers })
        if (!response.ok) {
          const text = await response.text().catch(() => '')
          return {
            success: false,
            models: [],
            message: `HTTP ${response.status}: ${text.slice(0, 200) || response.statusText}`,
          }
        }

        const payload = await response.json()
        const raw = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.models)
            ? payload.models
            : Array.isArray(payload)
              ? payload
              : []

        const models = [...new Set(
          raw
            .map((item) => {
              if (typeof item === 'string')
                return item
              return item?.id || item?.name || item?.model
            })
            .filter(Boolean),
        )]

        return { success: true, models }
      }
      catch (error) {
        return {
          success: false,
          models: [],
          message: error?.message || String(error),
        }
      }
    })

    ipcxMain.handle(createChannel('setIdleTimeout'), async (_, timeout) => {
      copilotService.setIdleTimeout(timeout)
      return true
    })

    return () => {
      const methods = [
        'execute',
        'stop',
        'destroy',
        'destroyAll',
        'getSessionByDevice',
        'getActiveSessions',
        'checkModelApi',
        'listModels',
        'setIdleTimeout',
      ]

      methods.forEach((method) => {
        ipcxMain.removeHandler(createChannel(method))
      })
    }
  },
}
