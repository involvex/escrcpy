/**
 * Pure helpers for copilot batch task bookkeeping.
 */

/**
 * Summarizes the `Promise.allSettled` output of a copilot batch run.
 * @param {Array<{ status: 'fulfilled'|'rejected', value?: { result?: string, errorMessage?: string, usage?: { promptTokens?: number, completionTokens?: number, totalTokens?: number } }, reason?: Error }>} settledResults
 * @returns {{ total: number, succeeded: number, failed: number, status: 'completed'|'partial'|'failed', firstError: string, promptTokens: number, completionTokens: number, totalTokens: number }}
 */
export function summarizeCopilotBatch(settledResults = []) {
  let succeeded = 0
  let failed = 0
  let firstError = ''
  let promptTokens = 0
  let completionTokens = 0
  let totalTokens = 0

  for (const item of settledResults) {
    const record = item?.status === 'fulfilled' ? item.value : null
    const usage = record?.usage

    if (usage) {
      promptTokens += Number(usage.promptTokens) || 0
      completionTokens += Number(usage.completionTokens) || 0
      totalTokens += Number(usage.totalTokens) || 0
    }

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
    promptTokens,
    completionTokens,
    totalTokens,
  }
}
