/**
 * Converged Work availability — single source of truth (manifests) + the
 * platform-index rule. Locks the post-convergence behavior.
 * @see src/souls/subscriptions.ts
 */
import { describe, it, expect } from 'vitest'
import { homeForWork, subscribersForWork, isWorkAvailable, isWorkPublished } from '@/souls/subscriptions'

describe('converged Work ownership (manifest = source of truth)', () => {
  it('owner comes from canonical.endeavor', () => {
    expect(homeForWork('holy-bible')).toBe('platform')
    expect(homeForWork('wdeg')).toBe('wheredideveryonego')
    // Resolved divergence: manifest canonical is authoritative (was 'platform' in
    // the old subscriptions map — that was the bug convergence fixes).
    // 'rainmaker' was unpublished 260710 (active legal matter): with no manifest
    // it falls back to 'platform', which is correct, not a regression.
    expect(homeForWork('answer53')).toBe('clearwater-cruisin')
    expect(homeForWork('gpt-psychosis')).toBe('clearwater-cruisin')
  })

  it('subscribers come from the manifest', () => {
    expect(subscribersForWork('holy-bible')).toContain('clearwater-cruisin')
    expect(subscribersForWork('wdeg')).toContain('clearwater-cruisin')
    expect(subscribersForWork('ready-player-everyone')).toEqual(
      expect.arrayContaining(['clearwater-cruisin', 'kendev']),
    )
  })
})

describe('the platform-index rule', () => {
  it('the flagship carries EVERY Work', () => {
    for (const id of ['holy-bible', 'wdeg', 'answer53', 'gpt-psychosis', 'ready-player-everyone']) {
      expect(isWorkAvailable(id, 'platform')).toBe(true)
    }
  })

  it('fixes WDEG-on-platform (was absent before convergence)', () => {
    expect(isWorkAvailable('wdeg', 'platform')).toBe(true)
  })

  it('still scopes non-platform endeavors to owner + subscribers', () => {
    expect(isWorkAvailable('holy-bible', 'clearwater-cruisin')).toBe(true)
    expect(isWorkAvailable('wdeg', 'clearwater-cruisin')).toBe(true)
    // A work not carried by an unrelated endeavor stays hidden there.
    expect(isWorkAvailable('rainmaker', 'wheredideveryonego')).toBe(false)
  })

  it('the Handbook is available everywhere', () => {
    expect(isWorkAvailable('angel-os-handbook', 'wheredideveryonego')).toBe(true)
    expect(isWorkAvailable('angel-os-handbook', 'clearwater-cruisin')).toBe(true)
  })

  it('unscoped context (no tenant) is unrestricted', () => {
    expect(isWorkAvailable('holy-bible', null)).toBe(true)
  })
})

describe('publish state (version-controlled working copies)', () => {
  it('only explicitly-published Works are public', () => {
    expect(isWorkPublished('wdeg')).toBe(true)
    expect(isWorkPublished('holy-bible')).toBe(true)
    expect(isWorkPublished('angel-os-handbook')).toBe(true)
  })
  // Every Work in the registry has since been published, so this can no longer
  // be pinned to a specific id — naming one just means the test goes red the day
  // someone publishes it. The rule itself still holds: publishing is OPT-IN, so
  // anything without an explicit `published: true` stays off the public lists.
  it('publishing is opt-in — anything without the flag is not published', () => {
    expect(isWorkPublished('no-such-work')).toBe(false)
  })
})
