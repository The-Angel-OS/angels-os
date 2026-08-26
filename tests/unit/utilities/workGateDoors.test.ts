import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

/**
 * A paywall with a second door is not a paywall.
 *
 * `works.access` was enforced only by the CoursePlayer block, so the first Work
 * ever put up for sale still served its whole 146 KB at its own canonical URL —
 * and at two API endpoints besides. Every surface that turns a Work slug into
 * that Work's text must ask `gateWorkBySlug` first.
 *
 * If you add another reader, add it here.
 */
const DOORS = [
  'src/blocks/CoursePlayer/Component.tsx',
  'src/app/[locale]/(app)/learn/[soul]/page.tsx',
  'src/app/[locale]/(app)/learn/[soul]/[page]/page.tsx',
  'src/endpoints/work-text.ts',
  'src/endpoints/works.ts',
]

describe('every door into a Work checks the gate', () => {
  it.each(DOORS)('%s', (file) => {
    expect(readFileSync(file, 'utf8')).toContain('gateWorkBySlug')
  })

  it('is actually looking at files — a guard that reads nothing passes forever', () => {
    expect(DOORS.length).toBeGreaterThan(4)
    expect(readFileSync(DOORS[0], 'utf8').length).toBeGreaterThan(100)
  })
})
