import { spawn as ptySpawn } from '@lydell/node-pty'
import { getAdbPath } from '$electron/configs/index.js'
import { setupEnvPath } from '$electron/process/helper.js'
import { BaseTerminalProvider } from './base.js'
import { assertSafeSerial } from '$electron/helpers/shell/safe-args.js'

/**
 * Device Terminal Provider — PTY-backed `adb shell` for colors and resize.
 */
export class DeviceTerminalProvider extends BaseTerminalProvider {
  /**
   * @param {Object} config
   * @param {string} config.instanceId
   * @param {Object} config.callbacks
   */
  constructor(config) {
    super(config)
    this.pty = null
    this.deviceId = null
    this._resizeTimer = null
    this._onData = this._onData.bind(this)
    this._onExit = this._onExit.bind(this)
  }

  /**
   * Launch ADB Shell terminal via node-pty
   * @param {Object} options
   * @param {string} options.deviceId - Device ID
   * @param {number} [options.cols]
   * @param {number} [options.rows]
   */
  async spawn(options = {}) {
    const { deviceId, cols = 90, rows = 24 } = options

    if (!deviceId) {
      throw new Error('[DeviceTerminal] deviceId is required')
    }

    assertSafeSerial(deviceId)
    setupEnvPath()

    this.deviceId = deviceId
    const adbPath = getAdbPath()

    if (!adbPath) {
      throw new Error('[DeviceTerminal] ADB path not found')
    }

    const enhancedEnv = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      LANG: process.env.LANG || 'en_US.UTF-8',
    }

    try {
      const ptyOptions = {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: process.cwd(),
        env: enhancedEnv,
      }

      if (process.platform === 'win32') {
        ptyOptions.useConpty = true
        ptyOptions.conptyInheritCursor = true
      }
      else {
        ptyOptions.encoding = 'utf8'
      }

      // Interactive shell with forced TTY allocation
      this.pty = ptySpawn(adbPath, ['-s', deviceId, 'shell', '-tt'], ptyOptions)
      this.isAlive = true

      this.pty.onData(this._onData)
      this.pty.onExit(this._onExit)
    }
    catch (error) {
      this._emitError({
        message: error.message,
        code: 'SPAWN_ERROR',
      })
      throw error
    }
  }

  /** @private */
  _onData(data) {
    this._emitData(data)
  }

  /** @private */
  _onExit({ exitCode, signal }) {
    this._emitExit(exitCode, signal)
    this.isAlive = false
  }

  /**
   * Write data to ADB shell PTY
   */
  write(data) {
    if (!this.pty || !this.isAlive) {
      console.warn('[DeviceTerminal] Cannot write: PTY not alive')
      return false
    }
    this.pty.write(data)
    return true
  }

  /**
   * Resize terminal via PTY winsize
   */
  resize(cols, rows) {
    if (!this.pty || !this.isAlive) {
      console.warn('[DeviceTerminal] Cannot resize: PTY not alive')
      return
    }

    clearTimeout(this._resizeTimer)
    this._resizeTimer = setTimeout(() => {
      if (this.pty && this.isAlive) {
        this.pty.resize(cols, rows)
      }
    }, 16)
  }

  /**
   * Destroy ADB Shell PTY
   */
  async destroy() {
    if (!this.pty) {
      return
    }

    try {
      this.pty.removeAllListeners()
      if (this.isAlive) {
        this.pty.kill()
        this.isAlive = false
      }
    }
    catch (error) {
      console.error('[DeviceTerminal] Destroy error:', error)
    }
    finally {
      this.pty = null
      this.deviceId = null
      clearTimeout(this._resizeTimer)
      this._resizeTimer = null
    }
  }
}
