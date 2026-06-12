import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSurface, setSurface, subscribeSurface, __resetSurface } from '@/components/ChatControl/surfaceStore'

// jsdom provides window.localStorage; clear it between tests.
beforeEach(() => {
  window.localStorage.clear()
  __resetSurface()
})

describe('surfaceStore', () => {
  it('defaults to empty when nothing stored', () => {
    expect(getSurface()).toEqual({ spaceId: null, channelSlug: '' })
  })

  it('merge-updates and persists to localStorage', () => {
    setSurface({ spaceId: 's1' })
    setSurface({ channelSlug: 'general' })
    expect(getSurface()).toEqual({ spaceId: 's1', channelSlug: 'general' })
    expect(JSON.parse(window.localStorage.getItem('angel-os:surface')!)).toEqual({ spaceId: 's1', channelSlug: 'general' })
  })

  it('notifies subscribers on change (the live-sync event)', () => {
    const seen: any[] = []
    const unsub = subscribeSurface((s) => seen.push(s))
    setSurface({ spaceId: 's1' })
    setSurface({ channelSlug: 'support' })
    unsub()
    setSurface({ spaceId: 's2' }) // after unsub — not seen
    expect(seen).toEqual([
      { spaceId: 's1', channelSlug: '' },
      { spaceId: 's1', channelSlug: 'support' },
    ])
  })

  it('no-ops (no notify) when the value is unchanged — prevents pub/sub loops', () => {
    setSurface({ spaceId: 's1', channelSlug: 'c' })
    const fn = vi.fn()
    subscribeSurface(fn)
    setSurface({ spaceId: 's1', channelSlug: 'c' }) // identical
    expect(fn).not.toHaveBeenCalled()
  })

  it('rehydrates from localStorage on a fresh module read (survives navigation)', () => {
    window.localStorage.setItem('angel-os:surface', JSON.stringify({ spaceId: 's9', channelSlug: 'welcome' }))
    __resetSurface() // simulate a fresh ChatProvider mount on a new page
    expect(getSurface()).toEqual({ spaceId: 's9', channelSlug: 'welcome' })
  })
})
