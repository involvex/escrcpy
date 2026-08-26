export const ScheduleTimerType = {
  TIMEOUT: 'timeout',
  INTERVAL: 'interval',
  CRON: 'cron',
}

/**
 * Converts a schedule definition into a croner-compatible cron expression.
 * @param {{ timerType?: string, cronExpression?: string, timeout?: string|number, interval?: string|number, intervalType?: string }} schedule
 * @returns {string|null} cron expression, or null when the schedule is invalid
 */
export function convertScheduleToCronExpression(schedule) {
  if (schedule.timerType === ScheduleTimerType.CRON) {
    return schedule.cronExpression || null
  }

  if (schedule.timerType === ScheduleTimerType.TIMEOUT) {
    if (!schedule.timeout) {
      return null
    }

    const date = new Date(schedule.timeout)

    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      return null
    }

    return `${date.getSeconds()} ${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${date.getMonth() + 1} *`
  }

  if (schedule.timerType !== ScheduleTimerType.INTERVAL) {
    return null
  }

  const intervalValue = Number.parseInt(schedule.interval)

  if (!intervalValue || intervalValue <= 0) {
    return null
  }

  switch (schedule.intervalType) {
    case 'second':
      return `*/${intervalValue} * * * * *`
    case 'minute':
      return `*/${intervalValue} * * * *`
    case 'hour':
      return `0 */${intervalValue} * * *`
    case 'day':
      return `0 0 */${intervalValue} * *`
    case 'millisecond':
      return '* * * * * *'
    default:
      return `*/${intervalValue} * * * *`
  }
}
