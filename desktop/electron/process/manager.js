import treeKill from '@magda/tree-kill'

const PROCESS_EXIT_TIMEOUT = 3000

function waitForExit(process, timeout = PROCESS_EXIT_TIMEOUT) {
  return new Promise((resolve) => {
    if (!process || typeof process.on !== 'function') {
      resolve()
      return
    }

    const timer = setTimeout(() => {
      process.removeListener('exit', onExit)
      resolve()
    }, timeout)

    function onExit() {
      clearTimeout(timer)
      resolve()
    }

    process.once('exit', onExit)

    if (process.exitCode !== null || process.killed) {
      clearTimeout(timer)
      process.removeListener('exit', onExit)
      resolve()
    }
  })
}

/**
 * Process Manager
 */
export class ProcessManager {
  processList = []

  constructor() {
    this.processList = []
  }

  add(process) {
    this.processList.push(process)
    if (process && typeof process.once === 'function') {
      process.once('exit', () => {
        this.processList = this.processList.filter(item => item !== process)
      })
    }
  }

  async kill(process) {
    if (!process) {
      await Promise.allSettled(this.processList.map(item =>
        this.kill(item),
      ))
      this.processList = []
      return this
    }

    const pid = process?.pid || process
    await treeKill(pid, 'SIGTERM')
    await waitForExit(process)
    this.processList = this.processList.filter(item => item.pid !== pid)
    return this
  }
}
