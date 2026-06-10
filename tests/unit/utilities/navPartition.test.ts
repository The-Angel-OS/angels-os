import { describe, it, expect } from 'vitest'
import { partitionNavItems } from '@/utilities/navPartition'

const item = (url: string) => ({ id: url, link: { type: 'custom', label: url, url } })
const urls = (arr: { link: { url: string } }[]) => arr.map((i) => i.link.url)

describe('navPartition.partitionNavItems', () => {
  const menu = ['/', '/shop', '/posts', '/events', '/donate', '/dashboard'].map(item)

  it('caps inline items and overflows the rest in order', () => {
    const { primary, overflow } = partitionNavItems(menu, { maxInline: 3 })
    expect(urls(primary)).toEqual(['/', '/shop', '/posts'])
    expect(urls(overflow)).toEqual(['/events', '/donate', '/dashboard'])
  })

  it('forces Dashboard into overflow regardless of room', () => {
    const { primary, overflow } = partitionNavItems(menu, { maxInline: 10, forceOverflowUrls: ['/dashboard'] })
    expect(urls(primary)).toEqual(['/', '/shop', '/posts', '/events', '/donate'])
    expect(overflow.map((i) => i.link.url)).toContain('/dashboard')
  })

  it('demotes empty sections (Shop/Events) to overflow', () => {
    const { primary, overflow } = partitionNavItems(menu, {
      maxInline: 10,
      forceOverflowUrls: ['/dashboard'],
      demoteUrls: ['/shop', '/events'],
    })
    expect(urls(primary)).toEqual(['/', '/posts', '/donate'])
    expect(urls(overflow)).toEqual(['/shop', '/events', '/dashboard'])
  })

  it('keeps a populated section first-class (not in demoteUrls)', () => {
    // Shop populated → not demoted → stays primary; Events empty → demoted.
    const { primary } = partitionNavItems(menu, { maxInline: 10, demoteUrls: ['/events'] })
    expect(urls(primary)).toContain('/shop')
    expect(urls(primary)).not.toContain('/events')
  })

  it('handles empty menu', () => {
    expect(partitionNavItems([], { maxInline: 3 })).toEqual({ primary: [], overflow: [] })
  })
})
