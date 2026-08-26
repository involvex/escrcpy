import { describe, expect, it } from 'vitest'
import { summarizeCopilotBatch } from '../src/utils/copilot-task/index.js'

function fulfilled(result) {
  return { status: 'fulfilled', value: result }
}

function rejected(message) {
  return { status: 'rejected', reason: new Error(message) }
}

describe('summarizeCopilotBatch', () => {
  it('reports completed when every device succeeded', () => {
    const summary = summarizeCopilotBatch([
      fulfilled({ result: 'success' }),
      fulfilled({ result: 'success' }),
    ])

    expect(summary).toMatchObject({
      total: 2,
      succeeded: 2,
      failed: 0,
      status: 'completed',
    })
  })

  it('reports partial when some devices failed', () => {
    const summary = summarizeCopilotBatch([
      fulfilled({ result: 'success' }),
      fulfilled({ result: 'fail', errorMessage: 'device offline' }),
    ])

    expect(summary.status).toBe('partial')
    expect(summary.succeeded).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.firstError).toBe('device offline')
  })

  it('reports failed when nothing succeeded, preferring recorded errors', () => {
    const summary = summarizeCopilotBatch([
      fulfilled({ result: 'fail', errorMessage: 'timeout' }),
      rejected('crashed'),
    ])

    expect(summary.status).toBe('failed')
    expect(summary.succeeded).toBe(0)
    expect(summary.failed).toBe(2)
    expect(summary.firstError).toBe('timeout')
  })

  it('falls back to rejection reasons for error text', () => {
    const summary = summarizeCopilotBatch([rejected('boom')])
    expect(summary.firstError).toBe('boom')
  })

  it('treats empty batches as failed with an unknown error', () => {
    expect(summarizeCopilotBatch([])).toMatchObject({
      total: 0,
      status: 'failed',
      firstError: 'Unknown error',
    })
  })
})
