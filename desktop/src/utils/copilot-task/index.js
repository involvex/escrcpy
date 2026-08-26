/**
 * Pure helpers for copilot batch task bookkeeping.
 */

/**
 * Summarizes the `Promise.allSettled` output of a copilot batch run.
 * @param {Array<{ status: 'fulfilled'|'rejected', value?: { result?: string, errorMessage?: string }, reason?: Error }>} settledResults
 * @returns {{ total: number, succeeded: number, failed: number, status: 'completed'|'partial'|'failed', firstError: string }}
 */
export function summarizeCopilotBatch(settledResults = []) {
  let succeeded = 0
  let failed = 0
  let firstError = ''

  for (const item of settledResults) {
    const record = item?.status === 'fulfilled' ? item.value : null

    if (record?.result === 'success') {
      succeeded++
      continue
    }

    failed++

    if (!firstError) {
      firstError = record?.errorMessage || item?.reason?.message || 'Unknown error'
    }
  }

  const total = settledResults.length

  const status = total > 0 && failed === 0
    ? 'completed'
    : succeeded > 0
      ? 'partial'
      : 'failed'

  return {
    total,
    succeeded,
    failed,
    status,
    firstError: firstError || 'Unknown error',
  }
}
