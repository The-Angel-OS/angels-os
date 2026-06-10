import { describe, it, expect } from 'vitest'
import { injectEventsUnderNav, DEFAULT_EVENTS_DROPDOWN_COUNT } from '@/utilities/eventsNav'

const item = (label: string, url: string, extra: Record<string, unknown> = {}) => ({
  id: url,
  link: { type: 'custom', label, url },
  ...extra,
})

const NAV = [item('Home', '/'), item('Events', '/events'), item('Dashboard', '/dashboard')]

describe('eventsNav.injectEventsUnderNav', () => {
  it('hangs events under Events at /events/<slug> with image', () => {
    const out = injectEventsUnderNav(NAV, [
      { slug: 'cookout', title: 'Summer Cookout', image: '/t/c.jpg' },
      { slug: 'cleanup', title: 'Beach Cleanup' },
    ])
    const ev = out.find((i) => i.link.url === '/events')
    expect(ev.children.map((c: { link: { url: string } }) => c.link.url)).toEqual(['/events/cookout', '/events/cleanup'])
    expect(ev.children[0].image).toBe('/t/c.jpg')
    expect(ev.children[1].image).toBeUndefined()
  })

  it('defaults to top 5, configurable via max', () => {
    expect(DEFAULT_EVENTS_DROPDOWN_COUNT).toBe(5)
    const many = Array.from({ length: 9 }, (_, i) => ({ slug: `e${i}`, title: `E${i}` }))
    expect(injectEventsUnderNav(NAV, many).find((i) => i.link.url === '/events').children).toHaveLength(5)
    expect(injectEventsUnderNav(NAV, many, { max: 2 }).find((i) => i.link.url === '/events').children).toHaveLength(2)
  })

  it('returns nav unchanged with no events', () => {
    expect(injectEventsUnderNav(NAV, [])).toBe(NAV)
  })

  it('leaves non-Events items alone and dedups vs manual children', () => {
    const nav = [item('Events', '/events', { children: [{ link: { type: 'custom', label: 'Pinned', url: '/events/cookout' } }] }), item('Home', '/')]
    const out = injectEventsUnderNav(nav, [{ slug: 'cookout', title: 'Cookout' }, { slug: 'new', title: 'New' }])
    expect(out[0].children.map((c: { link: { url: string } }) => c.link.url)).toEqual(['/events/cookout', '/events/new'])
    expect(out[1].children).toBeUndefined()
  })
})
