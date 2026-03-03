/**
 * formatDateTime — Unit Tests
 *
 * Formats an ISO timestamp string into MM/DD/YYYY format.
 */
import { describe, it, expect } from 'vitest'

import { formatDateTime } from '@/utilities/formatDateTime'

describe('formatDateTime', () => {
  it('formats a standard ISO date string as MM/DD/YYYY', () => {
    // 2025-06-15 → 06/15/2025
    const result = formatDateTime('2025-06-15T00:00:00.000Z')
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(result).toContain('2025')
  })

  it('zero-pads single-digit months', () => {
    const result = formatDateTime('2025-01-20T00:00:00.000Z')
    // Month 1 → "01"
    expect(result.split('/')[0]).toMatch(/^0\d$/)
  })

  it('zero-pads single-digit days', () => {
    const result = formatDateTime('2025-03-05T00:00:00.000Z')
    expect(result.split('/')[1]).toMatch(/^0\d$/)
  })

  it('handles December (month 12)', () => {
    const result = formatDateTime('2024-12-25T00:00:00.000Z')
    expect(result).toContain('2024')
  })

  it('returns a string matching MM/DD/YYYY pattern', () => {
    const result = formatDateTime('2023-07-04T12:00:00Z')
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })

  it('falls back gracefully when timestamp is an empty string (uses current date)', () => {
    // When timestamp is empty, it uses new Date() — we can't assert exact value
    // but it should still return a valid MM/DD/YYYY format
    const result = formatDateTime('')
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })
})
