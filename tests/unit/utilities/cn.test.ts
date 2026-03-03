/**
 * cn (className utility) — Unit Tests
 *
 * Wraps clsx + tailwind-merge for conditional and deduplicating class merging.
 */
import { describe, it, expect } from 'vitest'

import { cn } from '@/utilities/cn'

describe('cn', () => {
  it('returns a single class unchanged', () => {
    expect(cn('bg-red-500')).toBe('bg-red-500')
  })

  it('merges multiple classes', () => {
    expect(cn('text-sm', 'font-bold')).toBe('text-sm font-bold')
  })

  it('merges conflicting Tailwind classes (last wins)', () => {
    // tailwind-merge should resolve the conflict by keeping the last value
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
  })

  it('handles conditional classes (truthy)', () => {
    expect(cn('base', true && 'extra')).toBe('base extra')
  })

  it('handles conditional classes (falsy)', () => {
    expect(cn('base', false && 'extra')).toBe('base')
  })

  it('ignores undefined and null values', () => {
    expect(cn('base', undefined, null)).toBe('base')
  })

  it('returns empty string when no classes', () => {
    expect(cn()).toBe('')
  })

  it('handles object syntax from clsx', () => {
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500')
  })

  it('merges padding classes correctly', () => {
    // tailwind-merge knows p-4 and px-2 are incompatible in a specific way
    const result = cn('p-4', 'px-2')
    expect(result).toContain('px-2')
  })
})
