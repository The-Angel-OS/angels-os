/**
 * Unit tests for the moderation reflex classifier.
 *
 * @see src/utilities/moderation.ts
 */
import { describe, it, expect } from 'vitest'
import { moderateText } from '@/utilities/moderation'

const NOW = '2026-06-19T00:00:00.000Z'

describe('moderateText', () => {
  it('passes ordinary chat as ok with no categories', () => {
    const v = moderateText('Hey everyone, anyone around for the move this weekend?', NOW)
    expect(v.status).toBe('ok')
    expect(v.categories).toEqual([])
    expect(v.score).toBe(0)
    expect(v.by).toBe('heuristic')
    expect(v.at).toBe(NOW)
  })

  it('is fail-soft on empty / non-string input', () => {
    expect(moderateText('', NOW).status).toBe('ok')
    expect(moderateText('   ', NOW).status).toBe('ok')
    expect(moderateText(null, NOW).status).toBe('ok')
    expect(moderateText(undefined, NOW).status).toBe('ok')
    expect(moderateText(42 as unknown, NOW).status).toBe('ok')
  })

  it('flags a credible directed threat for review', () => {
    const v = moderateText('i am going to kill you when i see you', NOW)
    expect(v.status).toBe('review')
    expect(v.categories).toContain('threat')
    expect(v.score).toBeGreaterThanOrEqual(5)
    expect(v.reason).toMatch(/threat/)
  })

  it('flags self-harm statements for review', () => {
    expect(moderateText('honestly i want to die', NOW).categories).toContain('self_harm')
    expect(moderateText('kys', NOW).categories).toContain('self_harm')
  })

  it('blocks the highest-severity (minor safety) tier', () => {
    const v = moderateText('explicit photos of a 12 year old', NOW)
    expect(v.status).toBe('block')
    expect(v.categories).toContain('sexual_minors')
    expect(v.score).toBeGreaterThanOrEqual(9)
  })

  it('does not flag emotionally-charged but non-threatening venting', () => {
    expect(moderateText('this traffic is killing me lol', NOW).status).toBe('ok')
    expect(moderateText('that movie was a total murder of the book', NOW).status).toBe('ok')
    expect(moderateText('i could kill for a coffee right now', NOW).status).toBe('ok')
  })

  it('truncates very long input without throwing', () => {
    const huge = 'a'.repeat(20000) + ' i am going to kill you'
    const v = moderateText(huge, NOW)
    // The threat is past the 4000-char sample window, so it is intentionally not seen.
    expect(v.status).toBe('ok')
  })
})
