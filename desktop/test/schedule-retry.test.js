import { describe, expect, it } from 'vitest'
import { getNextRetryAt } from '../src/store/schedule/pure-helpers.js'

describe('getNextRetryAt', () => {
  it('returns a timestamp in the future', () => {
    const now = Date.now()
    const retryAt = getNextRetryAt(0)
    expect(retryAt).toBeGreaterThanOrEqual(now)
  })

  it('applies exponential backoff based on retry count', () => {
    const first = getNextRetryAt(0)
    const second = getNextRetryAt(1)
    const third = getNextRetryAt(2)

    const firstDelay = first - Date.now()
    const secondDelay = second - Date.now()
    const thirdDelay = third - Date.now()

    expect(firstDelay).toBeLessThanOrEqual(1100)
    expect(secondDelay).toBeLessThanOrEqual(2100)
    expect(thirdDelay).toBeLessThanOrEqual(4100)
  })

  it('caps backoff at 5 minutes', () => {
    const retryAt = getNextRetryAt(10)
    const delay = retryAt - Date.now()
    expect(delay).toBeLessThanOrEqual(5 * 60 * 1000 + 100)
  })

  it('defaults to retry count of 0', () => {
    const retryAt = getNextRetryAt()
    const delay = retryAt - Date.now()
    expect(delay).toBeLessThanOrEqual(1100)
  })
})
