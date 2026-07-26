/**
 * Unit tests for the scripture reference resolver.
 * @see src/utilities/scripture.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseReference, lookupScripture } from '@/utilities/scripture'

// lookupScripture reads the book over HTTP from `origin` (it stays client-safe,
// so no fs). These tests used to call it with no origin at all, which meant
// NEXT_PUBLIC_SERVER_URL was empty and every one of them got "Scripture source
// is not configured" — a red suite that proved nothing about the resolver.
// Serve the committed book from disk instead: real data, no network.
const ORIGIN = 'http://scripture.test'
const realFetch = globalThis.fetch

beforeAll(() => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (!url.startsWith(ORIGIN)) return realFetch(input as RequestInfo)
    const rel = url.slice(ORIGIN.length).replace(/^\//, '').split('/')
    const body = readFileSync(join(process.cwd(), 'public', ...rel), 'utf8')
    return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
})

afterAll(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

describe('parseReference', () => {
  it('parses a single verse', () => {
    expect(parseReference('John 3:16')).toMatchObject({ code: 'JHN', chapter: 3, verseStart: 16 })
  })
  it('parses a range', () => {
    expect(parseReference('Romans 8:28-30')).toMatchObject({ code: 'ROM', chapter: 8, verseStart: 28, verseEnd: 30 })
  })
  it('parses a whole chapter', () => {
    expect(parseReference('Psalm 23')).toMatchObject({ code: 'PSA', chapter: 23, verseStart: undefined })
  })
  it('parses numbered + abbreviated books', () => {
    expect(parseReference('1 John 4:8')).toMatchObject({ code: '1JN', chapter: 4, verseStart: 8 })
    expect(parseReference('Phlm 1:6')).toMatchObject({ code: 'PHM', chapter: 1, verseStart: 6 })
  })
  it('rejects nonsense', () => {
    expect(parseReference('not a verse')).toBeNull()
    expect(parseReference('')).toBeNull()
  })
})

describe('lookupScripture', () => {
  it('resolves Philemon 1:6 in WEB (default)', async () => {
    const r = await lookupScripture('Philemon 1:6', 'web', ORIGIN)
    expect(r.ok).toBe(true)
    expect(r.reference).toBe('Philemon 1:6')
    expect(r.translation).toBe('web')
    expect(r.verses).toHaveLength(1)
    expect(r.text).toMatch(/fellowship of your faith/i)
  })
  it('resolves the same verse differently in KJV', async () => {
    const r = await lookupScripture('Philemon 1:6', 'kjv', ORIGIN)
    expect(r.ok).toBe(true)
    expect(r.text).toMatch(/communication of thy faith/i)
  })
  it('errors clearly on an out-of-range verse', async () => {
    const r = await lookupScripture('Philemon 1:99', 'web', ORIGIN)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/no verse/i)
  })
})
