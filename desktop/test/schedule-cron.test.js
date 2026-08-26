import { describe, expect, it } from 'vitest'
import {
  convertScheduleToCronExpression,
  ScheduleTimerType,
} from '../electron/modules/schedule/cron-expression.js'

function futureDate(hoursAhead = 24) {
  return new Date(Date.now() + hoursAhead * 3600 * 1000)
}

describe('convertScheduleToCronExpression', () => {
  it('passes through explicit cron expressions', () => {
    expect(convertScheduleToCronExpression({
      timerType: ScheduleTimerType.CRON,
      cronExpression: '0 9 * * 1',
    })).toBe('0 9 * * 1')
  })

  it('returns null for cron schedules without an expression', () => {
    expect(convertScheduleToCronExpression({
      timerType: ScheduleTimerType.CRON,
    })).toBeNull()
  })

  it('converts future timeouts into one-shot cron fields', () => {
    const date = futureDate()
    const expression = convertScheduleToCronExpression({
      timerType: ScheduleTimerType.TIMEOUT,
      timeout: date.toISOString(),
    })
    const expected
      = `${date.getSeconds()} ${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${date.getMonth() + 1} *`
    expect(expression).toBe(expected)
  })

  it('rejects timeouts in the past', () => {
    expect(convertScheduleToCronExpression({
      timerType: ScheduleTimerType.TIMEOUT,
      timeout: new Date(Date.now() - 60_000).toISOString(),
    })).toBeNull()
  })

  it('rejects invalid or missing timeouts', () => {
    expect(convertScheduleToCronExpression({
      timerType: ScheduleTimerType.TIMEOUT,
      timeout: '',
    })).toBeNull()
    expect(convertScheduleToCronExpression({
      timerType: ScheduleTimerType.TIMEOUT,
      timeout: 'not-a-date',
    })).toBeNull()
  })

  it.each([
    ['second', '*/10 * * * * *'],
    ['minute', '*/10 * * * *'],
    ['hour', '0 */10 * * *'],
    ['day', '0 0 */10 * *'],
  ])('converts interval unit %s', (unit, expected) => {
    expect(convertScheduleToCronExpression({
      timerType: ScheduleTimerType.INTERVAL,
      interval: '10',
      intervalType: unit,
    })).toBe(expected)
  })

  it('collapses millisecond intervals to every second', () => {
    expect(convertScheduleToCronExpression({
      timerType: ScheduleTimerType.INTERVAL,
      interval: '500',
      intervalType: 'millisecond',
    })).toBe('* * * * * *')
  })

  it('defaults unknown interval units to minutes', () => {
    expect(convertScheduleToCronExpression({
      timerType: ScheduleTimerType.INTERVAL,
      interval: '7',
      intervalType: 'fortnight',
    })).toBe('*/7 * * * *')
  })

  it('rejects non-positive or non-numeric intervals', () => {
    for (const interval of ['0', '-5', 'abc']) {
      expect(convertScheduleToCronExpression({
        timerType: ScheduleTimerType.INTERVAL,
        interval,
        intervalType: 'minute',
      })).toBeNull()
    }
  })

  it('returns null for unknown timer types', () => {
    expect(convertScheduleToCronExpression({ timerType: 'lunar' })).toBeNull()
  })
})
