import { describe, expect, it, vi } from 'vitest'
import {
  AUTOMATION_KEYCODES,
  AutomationStepType,
  buildDeviceCommand,
  normalizeTextForInput,
  runAutomationSteps,
  validateAutomationSteps,
} from '../src/utils/automation/index.js'

describe('normalizeTextForInput', () => {
  it('escapes whitespace as %s for android input text', () => {
    expect(normalizeTextForInput('hello world')).toBe('hello%sworld')
    expect(normalizeTextForInput('a\tb\nc')).toBe('a%sb%sc')
  })

  it('strips characters that break adb shell quoting', () => {
    expect(normalizeTextForInput('say "hi"; rm -rf &')).toBe('say%shi%srm%s-rf')
    expect(normalizeTextForInput('it\'s $HOME `pwd` | pipe')).toBe('its%sHOME%spwd%spipe')
  })

  it('keeps common safe punctuation', () => {
    expect(normalizeTextForInput('user@example.com')).toBe('user@example.com')
    expect(normalizeTextForInput('v2.11.1_ok')).toBe('v2.11.1_ok')
  })
})

describe('buildDeviceCommand', () => {
  it('builds tap commands', () => {
    expect(buildDeviceCommand({ type: 'tap', x: 100, y: 200 })).toBe('input tap 100 200')
  })

  it('builds swipe commands with optional duration', () => {
    expect(buildDeviceCommand({
      type: 'swipe',
      startX: 10,
      startY: 20,
      endX: 30,
      endY: 40,
    })).toBe('input swipe 10 20 30 40')

    expect(buildDeviceCommand({
      type: 'swipe',
      startX: 10,
      startY: 20,
      endX: 30,
      endY: 40,
      duration: 500,
    })).toBe('input swipe 10 20 30 40 500')
  })

  it('builds text commands with sanitized input', () => {
    expect(buildDeviceCommand({ type: 'text', value: 'hello world' }))
      .toBe('input text hello%sworld')
  })

  it('accepts numeric and named key codes', () => {
    expect(buildDeviceCommand({ type: 'key', code: 4 })).toBe('input keyevent 4')
    expect(buildDeviceCommand({ type: 'key', code: 'BACK' })).toBe(`input keyevent ${AUTOMATION_KEYCODES.BACK}`)
  })

  it('returns null for wait steps', () => {
    expect(buildDeviceCommand({ type: 'wait', ms: 1000 })).toBeNull()
  })

  it('passes device shell commands through, trimming the shell prefix', () => {
    expect(buildDeviceCommand({ type: 'command', value: 'shell input keyevent 26' }))
      .toBe('input keyevent 26')
    expect(buildDeviceCommand({ type: 'command', value: 'dumpsys battery' }))
      .toBe('dumpsys battery')
  })
})

describe('validateAutomationSteps', () => {
  const tap = { type: 'tap', x: 1, y: 2 }

  it('accepts a valid mixed sequence', () => {
    const steps = [
      tap,
      { type: 'wait', ms: 250 },
      { type: 'key', code: 'HOME' },
    ]
    expect(validateAutomationSteps(steps)).toBeNull()
  })

  it('rejects empty or non-array configs', () => {
    expect(validateAutomationSteps([])).toMatch(/empty/i)
    expect(validateAutomationSteps(null)).toMatch(/empty/i)
  })

  it('reports unknown step types with their index', () => {
    expect(validateAutomationSteps([tap, { type: 'teleport' }])).toMatch(/#1/)
  })

  it.each([
    [{ type: 'tap', x: -5, y: 2 }],
    [{ type: 'swipe', startX: 0, startY: 0, endX: Number.NaN, endY: 9 }],
    [{ type: 'wait', ms: -1 }],
    [{ type: 'text', value: '' }],
    [{ type: 'command', value: '   ' }],
    [{ type: 'key' }],
  ])('rejects invalid step %j', (step) => {
    expect(validateAutomationSteps([step])).toBeTruthy()
  })
})

describe('runAutomationSteps', () => {
  it('executes steps sequentially with waits between them', async () => {
    const calls = []
    const sleeps = []
    const exec = vi.fn(async (_deviceId, command) => calls.push(command))
    const sleepFn = vi.fn(async ms => sleeps.push(ms))

    await runAutomationSteps(
      [
        { type: 'tap', x: 5, y: 6 },
        { type: 'wait', ms: 300 },
        { type: 'key', code: 4 },
      ],
      { deviceId: 'dev-1', exec, sleepFn },
    )

    expect(calls).toEqual(['input tap 5 6', 'input keyevent 4'])
    expect(sleeps).toEqual([300])
  })

  it('aborts with the failing step index when exec rejects', async () => {
    const exec = vi.fn(async (_deviceId, command) => {
      if (command.includes('keyevent')) {
        throw new Error('device offline')
      }
    })

    await expect(runAutomationSteps(
      [
        { type: 'tap', x: 1, y: 2 },
        { type: 'key', code: 4 },
      ],
      { deviceId: 'dev-1', exec },
    )).rejects.toThrowError(/step #1.*offline/s)
  })

  it('rejects invalid step lists before touching the device', async () => {
    const exec = vi.fn(async () => {})
    await expect(runAutomationSteps(
      [{ type: 'tap', x: -1, y: 0 }],
      { deviceId: 'dev-1', exec },
    )).rejects.toThrowError(/invalid/i)
    expect(exec).not.toHaveBeenCalled()
  })
})

describe('automation step type vocabulary', () => {
  it('exposes the supported step vocabulary', () => {
    expect(Object.values(AutomationStepType)).toEqual([
      'tap',
      'swipe',
      'text',
      'key',
      'wait',
      'command',
    ])
  })
})
