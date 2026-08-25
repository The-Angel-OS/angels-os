import { describe, expect, it } from 'vitest'
import { buildTextWindow, TEXT_WINDOW_RADIUS } from '@/utilities/workTextWindow'

const pages = Array.from({ length: 1189 }, (_, i) => ({
  translations: { web: `chapter ${i}`, kjv: `chapitre ${i}` },
}))

describe('buildTextWindow', () => {
  it('sends a window, not the book — this is the 9.65 MB fix', () => {
    const w = buildTextWindow(pages, 600, 'web')
    expect(Object.keys(w)).toEqual(['web']) // one language, not all of them
    expect(Object.keys(w.web)).toHaveLength(TEXT_WINDOW_RADIUS * 2 + 1)
    expect(w.web['600']).toBe('chapter 600')
  })

  it('clamps at both ends instead of emitting negative or missing indices', () => {
    expect(Object.keys(buildTextWindow(pages, 0, 'web').web)).toHaveLength(TEXT_WINDOW_RADIUS + 1)
    const last = buildTextWindow(pages, 1188, 'web').web
    expect(Object.keys(last)).toHaveLength(TEXT_WINDOW_RADIUS + 1)
    expect(last['1188']).toBe('chapter 1188')
  })

  it('is empty — not broken — for a language the work does not carry', () => {
    expect(buildTextWindow(pages, 5, 'xx')).toEqual({ xx: {} })
    expect(buildTextWindow([], 0, 'web')).toEqual({ web: {} })
  })
})
