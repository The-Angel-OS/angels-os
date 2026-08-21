import { describe, it, expect } from 'vitest'
import { scaleScrim, scrimFactor } from '@/heros/scrim'

const FULLSCREEN =
  'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.30) 45%, rgba(0,0,0,0.65) 100%)'

describe('hero scrim', () => {
  it('leaves every existing hero untouched', () => {
    // 'strong' is the default AND what shipped before the dial existed, so an
    // unset value must return the gradient byte for byte.
    expect(scaleScrim(FULLSCREEN, undefined)).toBe(FULLSCREEN)
    expect(scaleScrim(FULLSCREEN, 'strong')).toBe(FULLSCREEN)
    expect(scaleScrim(FULLSCREEN, 'nonsense')).toBe(FULLSCREEN)
  })

  it('returns nothing at all for none — no element to composite', () => {
    expect(scaleScrim(FULLSCREEN, 'none')).toBe('')
    expect(scrimFactor('none')).toBe(0)
  })

  it('scales only the alpha, never the colour', () => {
    const medium = scaleScrim(FULLSCREEN, 'medium')
    expect(medium).toContain('rgba(0, 0, 0, 0.33)') // 0.55 * 0.6
    expect(medium).toContain('rgba(0, 0, 0, 0.18)') // 0.30 * 0.6
    expect(medium).toContain('linear-gradient(180deg')
    expect(medium).toContain('45%')
  })

  it('gets lighter as you dial down, monotonically', () => {
    const alpha = (g: string) => Number(g.match(/rgba\([^)]*?,\s*([\d.]+)\)/)?.[1] ?? 0)
    const strong = alpha(scaleScrim(FULLSCREEN, 'strong'))
    const medium = alpha(scaleScrim(FULLSCREEN, 'medium'))
    const light = alpha(scaleScrim(FULLSCREEN, 'light'))
    expect(strong).toBeGreaterThan(medium)
    expect(medium).toBeGreaterThan(light)
    expect(light).toBeGreaterThan(0)
  })
})
