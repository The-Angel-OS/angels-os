import { describe, it, expect } from 'vitest'
import { injectPostsUnderNav, injectEpisodesUnderNav } from '@/utilities/postsNav'

const item = (label: string, url: string, extra: Record<string, unknown> = {}) => ({
  id: url,
  link: { type: 'custom', label, url },
  ...extra,
})

const NAV = [item('Home', '/'), item('Posts', '/posts'), item('Dashboard', '/dashboard')]

describe('postsNav.injectPostsUnderNav', () => {
  it('hangs latest posts under the Posts item with /posts/<slug> + image', () => {
    const out = injectPostsUnderNav(NAV, [
      { slug: 'hello', title: 'Hello World', image: '/t/hello.jpg' },
      { slug: 'second', title: 'Second' },
    ])
    const posts = out.find((i) => i.link.url === '/posts')
    expect(posts.children.map((c: { link: { url: string } }) => c.link.url)).toEqual(['/posts/hello', '/posts/second'])
    expect(posts.children[0].image).toBe('/t/hello.jpg')
    expect(posts.children[1].image).toBeUndefined() // no image → no key
  })

  it('caps to max (default 5)', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ slug: `p${i}`, title: `P${i}` }))
    const out = injectPostsUnderNav(NAV, many)
    expect(out.find((i) => i.link.url === '/posts').children).toHaveLength(5)
  })

  it('matches Posts by label when url differs, and leaves other items alone', () => {
    const nav = [{ id: 'p', link: { type: 'custom', label: 'Posts', url: '/blog' } }, item('Home', '/')]
    const out = injectPostsUnderNav(nav, [{ slug: 'x', title: 'X' }])
    expect(out[0].children).toHaveLength(1)
    expect(out[1].children).toBeUndefined()
  })

  it('returns nav unchanged with no posts', () => {
    expect(injectPostsUnderNav(NAV, [])).toBe(NAV)
  })

  it('dedupes against manual children by URL', () => {
    const nav = [item('Posts', '/posts', { children: [{ link: { type: 'custom', label: 'Pinned', url: '/posts/hello' } }] })]
    const out = injectPostsUnderNav(nav, [{ slug: 'hello', title: 'Hello' }, { slug: 'new', title: 'New' }])
    expect(out[0].children.map((c: { link: { url: string } }) => c.link.url)).toEqual(['/posts/hello', '/posts/new'])
  })
})

describe('postsNav.injectEpisodesUnderNav', () => {
  const EP_NAV = [item('Home', '/'), item('Episodes', '/episodes'), item('Posts', '/posts')]

  it('hangs latest episodes under the Episodes item with /posts/<slug> + image', () => {
    const out = injectEpisodesUnderNav(EP_NAV, [
      { slug: 'ep-202', title: 'Episode 202', image: '/t/ep202.jpg' },
      { slug: 'ep-201', title: 'Episode 201' },
    ])
    const ep = out.find((i) => i.link.url === '/episodes')
    expect(ep.children.map((c: { link: { url: string } }) => c.link.url)).toEqual(['/posts/ep-202', '/posts/ep-201'])
    expect(ep.children[0].image).toBe('/t/ep202.jpg')
  })

  it('matches Video Log or Investigations as an Episodes item', () => {
    const nav = [item('Video Log', '/video-log'), item('Posts', '/posts')]
    const out = injectEpisodesUnderNav(nav, [{ slug: 'ep-1', title: 'Ep 1' }])
    expect(out[0].children).toHaveLength(1)
    expect(out[1].children).toBeUndefined()
  })
})
