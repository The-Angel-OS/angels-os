/**
 * dailyBread — deterministic 3-verses-a-day plan over the real committed canon
 * (public/library/holy-bible). No mocks: getSoul + loadBookFromPublic read the
 * repo's actual manifest/text files, so these assertions pin the plan itself —
 * if they ever fail, someone's daily bread changed.
 */
import { describe, it, expect } from 'vitest'
import { getDailyBread, DailyBreadError } from '@/utilities/dailyBread'

describe('getDailyBread', () => {
  it('serves Genesis 1:1–3 on the epoch day (2026-01-01)', async () => {
    const b = await getDailyBread({ date: '2026-01-01', origin: '' })
    expect(b.dayNumber).toBe(0)
    expect(b.ref).toBe('Genesis 1:1–3')
    expect(b.verses.map((v) => v.v)).toEqual([1, 2, 3])
    expect(b.verses[0]!.t).toMatch(/^In the beginning/)
    expect(b.page).toMatchObject({ order: 1 })
  })

  it('advances sequentially: day 2 serves Genesis 1:4–6', async () => {
    const b = await getDailyBread({ date: '2026-01-02', origin: '' })
    expect(b.dayNumber).toBe(1)
    expect(b.verses.map((v) => v.v)).toEqual([4, 5, 6])
  })

  it('crosses a chapter boundary without losing verses (Gen 1 has 31)', async () => {
    // Day 10 (start = 30) → Genesis 1:31 then Genesis 2:1–2.
    const b = await getDailyBread({ date: '2026-01-11', origin: '' })
    expect(b.verses).toHaveLength(3)
    expect(b.verses[0]).toMatchObject({ v: 31, chapter: 1 })
    expect(b.verses[1]).toMatchObject({ v: 1, chapter: 2 })
    expect(b.verses[2]).toMatchObject({ v: 2, chapter: 2 })
    expect(b.ref).toContain('–')
  })

  it('is deterministic: same date ⇒ identical verses', async () => {
    const [a, b] = await Promise.all([
      getDailyBread({ date: '2026-07-04', origin: '' }),
      getDailyBread({ date: '2026-07-04', origin: '' }),
    ])
    expect(a.verses).toEqual(b.verses)
    expect(a.ref).toBe(b.ref)
  })

  it('clamps count to 1..12 and defaults today when no date is given', async () => {
    const b = await getDailyBread({ count: 99, origin: '' })
    expect(b.count).toBe(12)
    expect(b.verses).toHaveLength(12)
    expect(b.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('serves the KJV edition when asked (local fs has no origin fetch)', async () => {
    // origin '' means the non-base fetch fails → falls back to base language.
    const b = await getDailyBread({ date: '2026-01-01', lang: 'kjv', origin: '' })
    expect(['web', 'kjv']).toContain(b.translation)
    expect(b.verses).toHaveLength(3)
  })

  it('rejects malformed dates and unknown souls', async () => {
    await expect(getDailyBread({ date: 'tomorrow', origin: '' })).rejects.toThrow(DailyBreadError)
    await expect(getDailyBread({ soulId: 'not-a-book', origin: '' })).rejects.toThrow(DailyBreadError)
  })
})
