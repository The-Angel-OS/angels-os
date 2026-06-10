import { describe, it, expect } from 'vitest'
import { backfillNavItems } from '@/utilities/navRepair'

const link = (label: string, url: string, id?: string) => ({
  ...(id ? { id } : {}),
  link: { type: 'custom', label, url },
})

const DEFAULTS = [link('Home', '/'), link('Posts', '/posts'), link('Contact', '/contact'), link('Dashboard', '/dashboard')]

describe('navRepair.backfillNavItems', () => {
  it('appends only the missing default links', () => {
    const existing = [link('Home', '/', 'a'), link('Posts', '/posts', 'b'), link('Dashboard', '/dashboard', 'c')]
    const { items, added } = backfillNavItems(existing, DEFAULTS)
    expect(added).toEqual(['/contact'])
    expect(items.map((i) => i.link.url)).toEqual(['/', '/posts', '/contact', '/dashboard'])
  })

  it('inserts missing links BEFORE /dashboard so it stays last', () => {
    const existing = [link('Home', '/', 'a'), link('Dashboard', '/dashboard', 'c')]
    const { items } = backfillNavItems(existing, DEFAULTS)
    expect(items.map((i) => i.link.url)).toEqual(['/', '/posts', '/contact', '/dashboard'])
  })

  it('appends at the end when there is no Dashboard link', () => {
    const existing = [link('Home', '/', 'a')]
    const { items } = backfillNavItems(existing, [link('Contact', '/contact')])
    expect(items.map((i) => i.link.url)).toEqual(['/', '/contact'])
  })

  it('preserves existing items and their ids untouched', () => {
    const existing = [link('Home', '/', 'a'), link('Dashboard', '/dashboard', 'c')]
    const { items } = backfillNavItems(existing, DEFAULTS)
    expect(items.find((i) => i.link.url === '/')?.id).toBe('a')
    expect(items.find((i) => i.link.url === '/dashboard')?.id).toBe('c')
  })

  it('is a no-op (same array, no additions) when nothing is missing', () => {
    const existing = DEFAULTS.map((d, i) => ({ ...d, id: String(i) }))
    const { items, added } = backfillNavItems(existing, DEFAULTS)
    expect(added).toEqual([])
    expect(items).toBe(existing)
  })

  it('ignores non-custom items when checking presence (does not crash)', () => {
    const existing = [{ id: 'x', link: { type: 'reference', label: 'A Page' } }, link('Home', '/', 'a')]
    const { added } = backfillNavItems(existing, [link('Contact', '/contact')])
    expect(added).toEqual(['/contact'])
  })
})
