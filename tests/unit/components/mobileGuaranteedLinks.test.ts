/**
 * The mobile sheet guarantees /learn and /works are reachable — but "demoted"
 * is not "hidden", and it used to conflate them. `menu` arrives already
 * filtered by the owner's hidden list, so a hidden route looks exactly like a
 * missing one, and the guarantee re-added precisely what was hidden. Hiding on
 * desktop was the way to FORCE something onto the phone.
 *
 * @see src/components/Header/MobileMenu.tsx
 */
import { describe, it, expect } from 'vitest'
import { withGuaranteedLinks } from '@/components/Header/MobileMenu'

const item = (url: string) => ({ id: url, link: { type: 'custom', label: url, url } })
const urls = (out: Array<{ link: { url: string } }>) => out.map((i) => i.link.url)

describe('MobileMenu.withGuaranteedLinks', () => {
  it('appends the mission links when the menu lacks them', () => {
    expect(urls(withGuaranteedLinks([item('/')]))).toEqual(['/', '/learn', '/works'])
  })

  it('does not duplicate a link the tenant nav already provides', () => {
    expect(urls(withGuaranteedLinks([item('/'), item('/works')]))).toEqual(['/', '/works', '/learn'])
  })

  it('respects the owner hiding them — the regression', () => {
    // Celersoft: a consultancy that hid /learn and /works on desktop and got
    // both back on mobile.
    expect(urls(withGuaranteedLinks([item('/')], ['/learn', '/works']))).toEqual(['/'])
  })

  it('hides only what was named', () => {
    expect(urls(withGuaranteedLinks([item('/')], ['/works']))).toEqual(['/', '/learn'])
  })

  it('survives a missing menu', () => {
    expect(urls(withGuaranteedLinks(undefined as never))).toEqual(['/learn', '/works'])
  })
})
