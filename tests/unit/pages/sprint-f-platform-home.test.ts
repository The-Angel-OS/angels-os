import { describe, it, expect } from 'vitest'
import { homeStaticData } from '@/endpoints/seed/home-static'

describe('Sprint F — Primary Platform Home Page & Creator Storefront Onboarding', () => {
  it('preserves the above-the-fold Angel OS hero and verbiage', () => {
    const data = homeStaticData()
    expect(data.slug).toBe('home')
    expect(data.title).toBe('Home')
    expect(data.hero).toBeDefined()
    expect(data.hero?.type).toBe('lowImpact')

    // Verifies the "Everyone Gets an Angel" verbiage remains intact
    const heroJson = JSON.stringify(data.hero)
    expect(heroJson).toContain('Everyone Gets an Angel')
    expect(heroJson).toContain('Guardian Angel')
  })

  it('delivers a rich, multi-section below-the-fold layout conforming to Patreon & Kessela aesthetics', () => {
    const data = homeStaticData()
    expect(Array.isArray(data.layout)).toBe(true)
    expect(data.layout.length).toBeGreaterThanOrEqual(8)

    const blockTypes = data.layout.map((b: { blockType: string }) => b.blockType)
    const blockNames = data.layout.map((b: { blockName?: string }) => b.blockName).filter(Boolean)

    // TrustRow
    expect(blockTypes).toContain('trustRow')

    // 4-Pillar Monetization Grid (Patreon duplication)
    expect(blockNames).toContain('four-pillars')

    // Creator Storefront & Zero-Inventory Merch
    expect(blockNames).toContain('creator-storefront')

    // Fee & Earnings Calculator
    expect(blockNames).toContain('fee-calculator')

    // LEO 2.0 AI Video Back-Catalog Vector RAG Spotlight
    expect(blockNames).toContain('leo-rag-spotlight')

    // Showcase Aurora Band (Kessela / Neuracare Pro signature aesthetic)
    expect(blockTypes).toContain('showcase')
    const showcase = data.layout.find((b: { blockType: string }) => b.blockType === 'showcase') as {
      background?: string
      statement?: string
      items?: unknown[]
    }
    expect(showcase?.background).toBe('aurora')
    expect(showcase?.statement).toContain('building your audience')
    expect(showcase?.items?.length).toBe(3)

    // Locked Pricing Ladder ($0 / $10 / $29 / $79)
    expect(blockNames).toContain('pricing-ladder')

    // Comprehensive Creator FAQ
    expect(blockTypes).toContain('faq')
    const faq = data.layout.find((b: { blockType: string }) => b.blockType === 'faq') as {
      items?: { question?: string; answer?: string }[]
    }
    expect(faq?.items?.length).toBeGreaterThanOrEqual(7)
    const faqText = JSON.stringify(faq)
    expect(faqText).toContain('Print-on-Demand')
    expect(faqText).toContain('Patreon')
    expect(faqText).toContain('YouTube')
    expect(faqText).toContain('Square')

    // Closing CTA Banner directing to /start
    expect(blockNames).toContain('creator-onboarding-cta')
  })

  it('provides meta tags focused on the Creator Operating System', () => {
    const data = homeStaticData()
    expect(data.meta?.title).toContain('Creator Operating System')
    expect(data.meta?.description).toContain('Patreon')
  })
})
