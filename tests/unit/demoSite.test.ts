/**
 * The demo-site funnel turns free text a stranger typed into a live subdomain,
 * so the two lossy steps get pinned here: slugifying a business name into a DNS
 * label, and matching however someone describes their trade onto a content pack.
 * Both fail quietly — a bad slug yields an unreachable site, a bad match yields
 * a plumber's site full of cleaning copy.
 */
import { describe, expect, it } from 'vitest'
import { slugifyBusinessName } from '@/endpoints/demo-site'
import { buildDemoSiteSpec, resolveTradePack, TRADE_PACKS } from '@/utilities/demoSiteTemplates'

describe('slugifyBusinessName', () => {
  it('produces a bare DNS label', () => {
    expect(slugifyBusinessName('Shine & Clean Solutions INC')).toBe('shineandcleansolutionsinc')
    expect(slugifyBusinessName('All American Local Movers')).toBe('allamericanlocalmovers')
    expect(slugifyBusinessName("Monica's Cleaning, LLC.")).toBe('monicascleaningllc')
  })

  it('never starts with a digit', () => {
    expect(slugifyBusinessName('24/7 Handyman')).toBe('x247handyman')
  })

  it('caps length so the label stays valid', () => {
    expect(slugifyBusinessName('a'.repeat(90)).length).toBeLessThanOrEqual(40)
  })

  it('yields empty for a name with nothing usable, so the caller can reject it', () => {
    expect(slugifyBusinessName('!!! ???')).toBe('')
  })
})

describe('resolveTradePack', () => {
  it.each([
    ['house cleaning', 'cleaning'],
    ['MAID SERVICE', 'cleaning'],
    ['All American Local Movers', 'moving'],
    ['hauling and relocation', 'moving'],
    ['photography studio', 'photography'],
    // BRE Solutions' ad leads with mowing and also sells pressure washing —
    // 'pressure washing' must not fall through to maid service.
    ['lawn mowing and landscaping', 'landscaping'],
    // 'probate'/'divorce' must not fall through to handyman on 'repair'.
    ['noncontested divorces and probate services', 'legal'],
    ['licensed attorney', 'legal'],
    ['estate planning law firm', 'legal'],
    ['LAWN MOWING*PRESSURE WASHING*LANDSCAPING', 'landscaping'],
    ['yard cleanup and tree work', 'landscaping'],
    ['power washing', 'landscaping'],
    ['bookkeeping and tax', 'accounting'],
    ['CPA', 'accounting'],
    ['HVAC contractor', 'handyman'],
    ['handyman services', 'handyman'],
    ['plumbing repair', 'handyman'],
  ])('matches %s to %s', (input, expected) => {
    expect(resolveTradePack(input).key).toBe(expected)
  })

  it('falls back to general rather than guessing', () => {
    expect(resolveTradePack('artisanal candle subscriptions').key).toBe('general')
    expect(resolveTradePack(undefined).key).toBe('general')
    expect(resolveTradePack('').key).toBe('general')
  })

  it('accepts an exact pack key', () => {
    for (const k of Object.keys(TRADE_PACKS)) expect(resolveTradePack(k).key).toBe(k)
  })
})

describe('buildDemoSiteSpec', () => {
  const base = { businessName: 'Shine & Clean', trade: 'cleaning', city: 'Gainesville, FL' }

  it('builds the five pages with unique slugs', () => {
    const pages = buildDemoSiteSpec(base)
    expect(pages.map((p) => p.slug)).toEqual(['home', 'services', 'about', 'faq', 'contact'])
    expect(new Set(pages.map((p) => p.slug)).size).toBe(5)
  })

  it('keeps home out of the nav but every other page in it', () => {
    const pages = buildDemoSiteSpec(base)
    expect(pages.find((p) => p.slug === 'home')!.showInNav).toBe(false)
    for (const p of pages.filter((x) => x.slug !== 'home')) expect(p.showInNav).not.toBe(false)
  })

  it('degrades to lowImpact heroes when there is no image, rather than an empty banner', () => {
    for (const p of buildDemoSiteSpec(base)) expect(p.heroType).toBe('lowImpact')
  })

  it('uses image heroes once one exists', () => {
    const pages = buildDemoSiteSpec({ ...base, heroMedia: 77 })
    expect(pages[0]!.heroType).toBe('fullScreen')
    expect(pages[0]!.heroImage).toBe(77)
    expect(pages[1]!.heroType).toBe('splitPanel')
  })

  it('always ends the contact page with a form', () => {
    const contact = buildDemoSiteSpec(base).find((p) => p.slug === 'contact')!
    expect(contact.sections!.at(-1)).toEqual({ contactForm: true })
  })

  it('carries the trade pack content onto the FAQ', () => {
    const faq = buildDemoSiteSpec(base).find((p) => p.slug === 'faq')!
    expect(faq.sections![0]!.faq!.items).toEqual(TRADE_PACKS.cleaning!.faq)
  })

  it('omits the city phrase entirely when no city was given', () => {
    const spec = buildDemoSiteSpec({ businessName: 'Acme' })
    expect(JSON.stringify(spec)).not.toContain('undefined')
    expect(JSON.stringify(spec)).not.toContain(' in .')
  })

  it('never leaves a dangling separator when only one contact detail is known', () => {
    const spec = buildDemoSiteSpec({ businessName: 'Acme', phone: '352-555-0100' })
    expect(JSON.stringify(spec)).not.toContain(' · ·')
    expect(JSON.stringify(spec)).toContain('352-555-0100')
  })
})
