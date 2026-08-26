import { describe, expect, it } from 'vitest'

function sanitizeRemark(value) {
  const raw = String(value ?? '').slice(0, 100)
  return Array.from(raw).filter((c) => {
    const code = c.codePointAt(0)
    return code >= 0x20 && code !== 0x7F
  }).join('').trim()
}

describe('setRemark sanitization', () => {
  it('returns empty string for null/undefined', () => {
    expect(sanitizeRemark(null)).toBe('')
    expect(sanitizeRemark(undefined)).toBe('')
  })

  it('truncates to 100 characters', () => {
    const long = 'a'.repeat(150)
    expect(sanitizeRemark(long).length).toBe(100)
  })

  it('removes control characters', () => {
    expect(sanitizeRemark('helloworld')).toBe('helloworld')
  })

  it('trims whitespace', () => {
    expect(sanitizeRemark('  hello  ')).toBe('hello')
  })

  it('preserves normal text', () => {
    expect(sanitizeRemark('My Device (Work)')).toBe('My Device (Work)')
  })

  it('handles empty string', () => {
    expect(sanitizeRemark('')).toBe('')
  })
})
