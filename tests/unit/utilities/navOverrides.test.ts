/**
 * The menu derives itself from what the endeavor has; overrides carry only the
 * owner's intent. These pin the three rules that aren't obvious from the types.
 */
import { describe, expect, it } from 'vitest'
import {
  applyNavOverrides,
  normalizeNavOverrides,
  EMPTY_NAV_OVERRIDES,
} from '@/utilities/navOverrides'

const item = (url: string) => ({ link: { url } })
const MENU = [item('/'), item('/shop'), item('/posts'), item('/book')]

describe('normalizeNavOverrides', () => {
  it('survives junk — a hand-edited settings bag must not break a nav', () => {
    expect(normalizeNavOverrides(null)).toEqual(EMPTY_NAV_OVERRIDES)
    expect(normalizeNavOverrides({ hidden: 'nope', pinned: [1, '/x', null] })).toEqual({
      hidden: [],
      pinned: ['/x'],
    })
  })

  it('drops a non-positive or non-numeric inline cap rather than rendering zero items', () => {
    // Zero with nothing pinned would render an empty bar — still dropped.
    expect(normalizeNavOverrides({ maxInline: 0 }).maxInline).toBeUndefined()
    expect(normalizeNavOverrides({ maxInline: -3 }).maxInline).toBeUndefined()
    expect(normalizeNavOverrides({ maxInline: 'six' }).maxInline).toBeUndefined()
    expect(normalizeNavOverrides({ maxInline: 4.7 }).maxInline).toBe(4)
  })
})

describe('applyNavOverrides', () => {
  it('hides what the owner does not want advertised', () => {
    const { items } = applyNavOverrides(MENU, { hidden: ['/shop'], pinned: [] })
    expect(items.map((i) => i.link.url)).toEqual(['/', '/posts', '/book'])
  })

  it('HIDDEN WINS OVER PINNED — a stale pin cannot resurrect a hidden item', () => {
    const { items, pinned } = applyNavOverrides(MENU, { hidden: ['/shop'], pinned: ['/shop', '/book'] })
    expect(items.map((i) => i.link.url)).not.toContain('/shop')
    expect(pinned).toEqual(['/book'])
  })

  it('passes the inline cap through only when set', () => {
    expect(applyNavOverrides(MENU, { hidden: [], pinned: [] }).maxInline).toBeUndefined()
    expect(applyNavOverrides(MENU, { hidden: [], pinned: [], maxInline: 3 }).maxInline).toBe(3)
  })

  it('carries hideMore through only when the owner set it', () => {
    expect(applyNavOverrides(MENU, { hidden: [], pinned: [] }).hideMore).toBeUndefined()
    expect(applyNavOverrides(MENU, { hidden: [], pinned: [], hideMore: true }).hideMore).toBe(true)
    // Hand-edited settings are the input here, so anything truthy normalizes to
    // the flag and anything else disappears rather than rendering "false".
    expect(normalizeNavOverrides({ hideMore: 'yes' }).hideMore).toBe(true)
    expect(normalizeNavOverrides({ hideMore: false }).hideMore).toBeUndefined()
  })

  it('is a no-op with empty overrides — the derived menu is the default', () => {
    expect(applyNavOverrides(MENU, EMPTY_NAV_OVERRIDES).items).toHaveLength(MENU.length)
  })
})

describe('normalizeNavOverrides zero cap with pins', () => {
  it('keeps a zero cap when pins guarantee the bar is not empty', () => {
    // Pinned items bypass the cap, so this is the only way to say "my pages and
    // nothing the platform derives" — a positive cap lets Discovery inline.
    const o = normalizeNavOverrides({ maxInline: 0, pinned: ['/', '/services'] })
    expect(o.maxInline).toBe(0)
    expect(o.pinned).toEqual(['/', '/services'])
  })
})
