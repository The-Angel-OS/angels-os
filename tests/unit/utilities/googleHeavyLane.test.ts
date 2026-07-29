import { describe, it, expect, beforeEach, afterEach } from 'vitest'

/**
 * GOOGLE_MODEL pins the FAST lanes, not every lane.
 *
 * It used to override all four tiers, which silently disabled escalation: a turn
 * resolved as tier "high" was still served flash-lite. On 260728-29 LEO called
 * update_post five times — four with `{}` for arguments — and finished with no
 * text. Same shape on analyze_image (no mediaId) and create_post_from_media (no
 * title). A small fast model can't populate tool arguments across 40 schemas, and
 * configuration was routing every deep-think round to it.
 *
 * This pins the RULE rather than the implementation: the pin applies below the
 * heavy lane, and high/critical get the tier map (or GOOGLE_MODEL_HEAVY).
 */
const GOOGLE_TIER_MAP: Record<string, string> = {
  low: 'gemini-flash-latest',
  medium: 'gemini-flash-latest',
  high: 'gemini-2.5-pro',
  critical: 'gemini-2.5-pro',
}

/** Mirrors attemptGoogle's selection. */
function pickModel(tier: string): string {
  const heavy = tier === 'high' || tier === 'critical'
  return heavy
    ? process.env.GOOGLE_MODEL_HEAVY || GOOGLE_TIER_MAP[tier]!
    : process.env.GOOGLE_MODEL || GOOGLE_TIER_MAP[tier]!
}

describe('Google lane selection', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    delete process.env.GOOGLE_MODEL
    delete process.env.GOOGLE_MODEL_HEAVY
  })
  afterEach(() => {
    process.env = { ...saved }
  })

  it('honours the fast-lane pin on low and medium', () => {
    process.env.GOOGLE_MODEL = 'gemini-flash-lite-latest'
    expect(pickModel('low')).toBe('gemini-flash-lite-latest')
    expect(pickModel('medium')).toBe('gemini-flash-lite-latest')
  })

  it('does NOT let the fast-lane pin flatten high and critical', () => {
    process.env.GOOGLE_MODEL = 'gemini-flash-lite-latest'
    expect(pickModel('high')).toBe('gemini-2.5-pro')
    expect(pickModel('critical')).toBe('gemini-2.5-pro')
  })

  it('lets GOOGLE_MODEL_HEAVY override the heavy lane, and only that lane', () => {
    process.env.GOOGLE_MODEL = 'gemini-flash-lite-latest'
    process.env.GOOGLE_MODEL_HEAVY = 'gemini-flash-latest'
    expect(pickModel('high')).toBe('gemini-flash-latest')
    expect(pickModel('low')).toBe('gemini-flash-lite-latest')
  })

  it('falls back to the tier map when nothing is pinned', () => {
    expect(pickModel('low')).toBe('gemini-flash-latest')
    expect(pickModel('high')).toBe('gemini-2.5-pro')
  })
})
