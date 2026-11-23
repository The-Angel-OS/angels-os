/**
 * The mobile sheet previously force-appended /learn and /works onto every portal.
 * New creator portals omit both from the brochure nav (/learn lives in the
 * dashboard; /works is opt-in via tenant.features.works upstream).
 *
 * @see src/components/Header/MobileMenu.tsx
 */
import { describe, it, expect } from 'vitest'
import { withGuaranteedLinks } from '@/components/Header/MobileMenu'

const item = (url: string) => ({ id: url, link: { type: 'custom', label: url, url } })
const urls = (out: Array<{ link: { url: string } }>) => out.map((i) => i.link.url)

describe('MobileMenu.withGuaranteedLinks', () => {
  it('does not inject /learn or /works onto portals without them', () => {
    expect(urls(withGuaranteedLinks([item('/')]))).toEqual(['/'])
  })

  it('preserves opt-in /works when provided upstream', () => {
    expect(urls(withGuaranteedLinks([item('/'), item('/works')]))).toEqual(['/', '/works'])
  })

  it('still respects the owner hiddenUrls filter', () => {
    expect(urls(withGuaranteedLinks([item('/'), item('/works')], ['/works']))).toEqual(['/'])
  })

  it('survives a missing menu', () => {
    expect(urls(withGuaranteedLinks(undefined as never))).toEqual([])
  })
})
