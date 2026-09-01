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

describe('the computer-repair pack', () => {
  it('matches the words a computer tech actually uses', () => {
    for (const t of [
      'computer repair',
      'onsite computer service',
      'PC troubleshooting',
      'laptop repair',
      'tech support',
      'virus removal',
      'home networking',
      'wifi setup',
    ]) {
      expect(resolveTradePack(t).key).toBe('techsupport')
    }
  })

  it('does not steal the trades that share its words', () => {
    // 'repair' and 'electric' are in the handyman matcher; the tech matcher
    // runs first, so these are the cases that would break if it over-reached.
    expect(resolveTradePack('appliance repair').key).toBe('handyman')
    expect(resolveTradePack('electrician').key).toBe('handyman')
    expect(resolveTradePack('pressure washing').key).toBe('landscaping')
    expect(resolveTradePack('probate').key).toBe('legal')
  })
})

describe('“removal” is not “moving”', () => {
  it('does not route removals to a moving company', () => {
    // 'removal'.includes('mov') is true — the old needle was three letters and
    // quietly swallowed every trade that removes something.
    expect(resolveTradePack('virus removal').key).toBe('techsupport')
    expect(resolveTradePack('junk removal and hauling').key).toBe('moving') // hauling, legitimately
    expect(resolveTradePack('tree removal').key).toBe('landscaping')
  })

  it('still matches an actual mover', () => {
    for (const t of ['moving company', 'local movers', 'we move apartments', 'relocation services']) {
      expect(resolveTradePack(t).key).toBe('moving')
    }
  })
})

/**
 * The enterprise pack is the first one that overrides the VOICE, not just the
 * services — so the two things it can silently get wrong are being routed to
 * the wrong pack (it trips 'network' and ' it ', which belong to techsupport)
 * and leaking the small-business copy that every other pack wants. Both would
 * be discovered by a CIO reading "we are a local business" on their own site.
 */
describe('enterprise pack', () => {
  it('claims the B2B vocabulary a homeowner never uses', () => {
    for (const t of [
      'enterprise IT services and consulting',
      'IT consulting',
      'ERP implementation',
      'SAP and Oracle integration',
      'cybersecurity and SIEM',
      'managed services provider',
      'data center and cloud infrastructure',
      'IT staffing',
      'business analytics',
      'microservices and devops',
      'digital transformation',
    ]) {
      expect(resolveTradePack(t).key).toBe('enterprise')
    }
  })

  it('does not steal the consumer trades that share its words', () => {
    // These all contain enterprise needles ('network', 'computer', ' it ') and
    // must still reach the pack that actually sells to a person at home.
    expect(resolveTradePack('home networking').key).toBe('techsupport')
    expect(resolveTradePack('computer repair').key).toBe('techsupport')
    expect(resolveTradePack('wifi setup').key).toBe('techsupport')
  })

  it('replaces the local-business copy rather than adding to it', () => {
    const spec = buildDemoSiteSpec({
      businessName: 'Celersoft LLC',
      trade: 'enterprise IT services and consulting',
      city: 'Houston, TX',
    })
    const text = JSON.stringify(spec)
    for (const leak of [
      'We are a local business',
      'Licensed & Insured',
      'Locally Owned',
      'Free Estimates',
      'locally owned',
      'turn up when we said',
    ]) {
      expect(text).not.toContain(leak)
    }
    expect(text).toContain('SOC 2 & ISO 27001')
  })

  it('inserts the assessment page and keeps Contact last in the nav', () => {
    const spec = buildDemoSiteSpec({ businessName: 'Celersoft LLC', trade: 'IT consulting' })
    const slugs = spec.map((p) => p.slug)
    expect(slugs).toEqual(['home', 'services', 'about', 'faq', 'assessment', 'contact'])

    const assessment = spec.find((p) => p.slug === 'assessment')!
    const contact = spec.find((p) => p.slug === 'contact')!
    expect(contact.navOrder).toBeGreaterThan(assessment.navOrder!)

    // The lead magnet is only a lead magnet if it actually captures.
    expect(assessment.sections?.some((s) => s.contactForm)).toBe(true)
  })

  /**
   * Found the hard way: the assessment page asks for a splitPanel hero, the run
   * had no generated image, and Payload rejected the page with
   * `Hero > Media is invalid` — after four pages had already been written.
   */
  it('degrades an extra page\u2019s image hero when there is no image', () => {
    const spec = buildDemoSiteSpec({ businessName: 'Celersoft LLC', trade: 'IT consulting' })
    const assessment = spec.find((p) => p.slug === 'assessment')!
    expect(assessment.heroType).toBe('lowImpact')
    expect(assessment.heroImage).toBeUndefined()
  })

  it('gives an extra page the hero image when there is one', () => {
    const spec = buildDemoSiteSpec({
      businessName: 'Celersoft LLC',
      trade: 'IT consulting',
      heroMedia: 489,
    })
    const assessment = spec.find((p) => p.slug === 'assessment')!
    expect(assessment.heroType).toBe('splitPanel')
    expect(assessment.heroImage).toBe(489)
  })

  it('leaves every other pack on the default voice', () => {
    const spec = buildDemoSiteSpec({ businessName: 'Bob Handyman', trade: 'handyman' })
    expect(spec.map((p) => p.slug)).toEqual(['home', 'services', 'about', 'faq', 'contact'])
    expect(JSON.stringify(spec)).toContain('Licensed & Insured')
  })
})
