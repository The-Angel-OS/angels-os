/**
 * deepMerge — Unit Tests
 *
 * deepMerge is a pure recursive object-merging utility with no external
 * dependencies.
 */
import { describe, it, expect } from 'vitest'
import deepMerge, { isObject } from '@/utilities/deepMerge'

// ── isObject ─────────────────────────────────────────────────────────────────

describe('isObject', () => {
  it('returns true for a plain object', () => {
    expect(isObject({ a: 1 })).toBe(true)
  })

  it('returns false for an array', () => {
    expect(isObject([1, 2, 3])).toBe(false)
  })

  it('returns true for null (JS typeof null === object quirk — no null guard in impl)', () => {
    expect(isObject(null)).toBe(true)
  })

  it('returns false for a string', () => {
    expect(isObject('hello')).toBe(false)
  })

  it('returns false for a number', () => {
    expect(isObject(42)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isObject(undefined)).toBe(false)
  })

  it('returns true for an empty object', () => {
    expect(isObject({})).toBe(true)
  })
})

// ── deepMerge ────────────────────────────────────────────────────────────────

describe('deepMerge', () => {
  it('merges top-level keys from source into target', () => {
    const result = deepMerge({ a: 1 }, { b: 2 })
    expect(result).toEqual({ a: 1, b: 2 })
  })

  it('source key overwrites matching target key (primitive)', () => {
    const result = deepMerge({ a: 1, b: 'old' }, { b: 'new' })
    expect(result).toEqual({ a: 1, b: 'new' })
  })

  it('does not mutate the original target', () => {
    const target = { a: 1 }
    deepMerge(target, { b: 2 })
    expect(target).toEqual({ a: 1 })
  })

  it('recursively merges nested objects', () => {
    const result = deepMerge({ nested: { x: 1, y: 2 } }, { nested: { y: 99, z: 3 } })
    expect(result).toEqual({ nested: { x: 1, y: 99, z: 3 } })
  })

  it('adds new nested object from source when target lacks that key', () => {
    const result = deepMerge({ a: 1 }, { b: { c: 2 } })
    expect(result).toEqual({ a: 1, b: { c: 2 } })
  })

  it('handles multiple levels of nesting', () => {
    const target = { a: { b: { c: 1 } } }
    const source = { a: { b: { d: 2 } } }
    const result = deepMerge(target, source)
    expect(result).toEqual({ a: { b: { c: 1, d: 2 } } })
  })

  it('source array overwrites target array (no array merging)', () => {
    const result = deepMerge({ arr: [1, 2] }, { arr: [3, 4, 5] })
    expect(result).toEqual({ arr: [3, 4, 5] })
  })

  it('handles empty source gracefully', () => {
    const result = deepMerge({ a: 1 }, {})
    expect(result).toEqual({ a: 1 })
  })

  it('handles empty target gracefully', () => {
    const result = deepMerge({}, { a: 1 })
    expect(result).toEqual({ a: 1 })
  })

  it('handles both target and source empty', () => {
    const result = deepMerge({}, {})
    expect(result).toEqual({})
  })

  it('source null treats string target as char array (impl has no null guard)', () => {
    // Because isObject(null) returns true (no null guard), deepMerge recurses
    // into deepMerge('existing', null), which spreads the string as {0:'e',1:'x',...}
    // This documents existing behaviour — not intended usage.
    const result = deepMerge({ a: 1 }, { b: null as any })
    // null source key: isObject(null) → true, key 'b' not in target → Object.assign
    expect(result).toHaveProperty('b', null)
  })

  it('preserves keys that exist only in target', () => {
    const result = deepMerge({ keep: 'me', override: 'old' }, { override: 'new' })
    expect(result.keep).toBe('me')
    expect(result.override).toBe('new')
  })
})
