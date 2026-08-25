/**
 * Read state is a blob that many writers touch, so the invariants it relies on
 * are worth pinning down: the mark only moves forward, junk never poisons the
 * map, and the map cannot grow without bound.
 *
 * The monotonic merge is the load-bearing one. It is what makes a read-modify-
 * write safe without a lock — two tabs cannot lose each other's progress, and a
 * late request from a stale tab cannot drag the marker backwards and resurrect
 * messages the user already read.
 */
import { describe, it, expect } from 'vitest'
import {
  capUnread,
  mergeReadState,
  MAX_TRACKED_CHANNELS,
  normalizeReadState,
  pruneReadState,
  sinceFor,
  UNREAD_CAP,
  type ReadState,
} from '@/utilities/readState'

const T1 = '2026-08-24T10:00:00.000Z'
const T2 = '2026-08-24T11:00:00.000Z'

describe('normalizeReadState', () => {
  it('passes through a well-formed map', () => {
    expect(normalizeReadState({ general: T1 })).toEqual({ general: T1 })
  })

  it('treats anything that is not an object map as empty', () => {
    for (const junk of [null, undefined, 'nope', 42, [T1], true]) {
      expect(normalizeReadState(junk)).toEqual({})
    }
  })

  it('drops entries that are not parseable timestamps', () => {
    expect(
      normalizeReadState({ good: T1, bad: 'yesterday', wrongType: 5, empty: '' }),
    ).toEqual({ good: T1 })
  })

  it('canonicalises to ISO so later string comparisons are meaningful', () => {
    expect(normalizeReadState({ general: '2026-08-24T10:00:00Z' })).toEqual({ general: T1 })
  })
})

describe('mergeReadState — monotonic', () => {
  it('records a mark for a channel that had none', () => {
    expect(mergeReadState({}, 'general', T1)).toEqual({ general: T1 })
  })

  it('moves the mark forward', () => {
    expect(mergeReadState({ general: T1 }, 'general', T2)).toEqual({ general: T2 })
  })

  it('NEVER moves the mark backwards — a stale tab cannot resurrect read messages', () => {
    expect(mergeReadState({ general: T2 }, 'general', T1)).toEqual({ general: T2 })
  })

  it('is idempotent — re-marking the same instant changes nothing', () => {
    expect(mergeReadState({ general: T1 }, 'general', T1)).toEqual({ general: T1 })
  })

  it('leaves other channels untouched', () => {
    expect(mergeReadState({ a: T1, b: T1 }, 'a', T2)).toEqual({ a: T2, b: T1 })
  })

  it('order of concurrent marks cannot change the outcome', () => {
    // Two tabs, opposite arrival order, same final state. This is the whole
    // reason no lock is needed.
    const forward = mergeReadState(mergeReadState({}, 'general', T1), 'general', T2)
    const reverse = mergeReadState(mergeReadState({}, 'general', T2), 'general', T1)
    expect(forward).toEqual(reverse)
    expect(forward).toEqual({ general: T2 })
  })

  it('ignores an unparseable timestamp rather than clearing the mark', () => {
    expect(mergeReadState({ general: T1 }, 'general', 'soon')).toEqual({ general: T1 })
  })

  it('ignores an empty channel slug', () => {
    expect(mergeReadState({ general: T1 }, '   ', T2)).toEqual({ general: T1 })
  })

  it('normalises whatever it was handed first', () => {
    expect(mergeReadState({ general: 'junk' }, 'other', T1)).toEqual({ other: T1 })
  })
})

describe('pruneReadState', () => {
  it('leaves a map under the cap alone', () => {
    const state: ReadState = { a: T1, b: T2 }
    expect(pruneReadState(state)).toBe(state)
  })

  it('keeps the most recently read channels and drops the oldest', () => {
    const state: ReadState = {}
    for (let i = 0; i < MAX_TRACKED_CHANNELS + 10; i++) {
      state[`c${i}`] = new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString()
    }
    const pruned = pruneReadState(state)
    expect(Object.keys(pruned)).toHaveLength(MAX_TRACKED_CHANNELS)
    // c0 is the oldest mark, so it goes; the newest survives.
    expect(pruned.c0).toBeUndefined()
    expect(pruned[`c${MAX_TRACKED_CHANNELS + 9}`]).toBeDefined()
  })

  it('merging into a full map still prunes', () => {
    const state: ReadState = {}
    for (let i = 0; i < MAX_TRACKED_CHANNELS; i++) {
      state[`c${i}`] = new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString()
    }
    const merged = mergeReadState(state, 'brand-new', T2)
    expect(Object.keys(merged)).toHaveLength(MAX_TRACKED_CHANNELS)
    expect(merged['brand-new']).toBe(T2)
  })
})

describe('sinceFor', () => {
  it('returns the mark when the channel has one', () => {
    expect(sinceFor({ general: T1 }, 'general')).toBe(T1)
  })

  it('returns null for a channel never read — everything in it is unread', () => {
    // Not "since now": a synthetic floor would silently swallow messages that
    // arrived between two polls of a channel the user has not opened yet.
    expect(sinceFor({}, 'general')).toBeNull()
  })
})

describe('capUnread', () => {
  it('passes small counts through', () => {
    expect(capUnread(0)).toBe(0)
    expect(capUnread(7)).toBe(7)
    expect(capUnread(UNREAD_CAP)).toBe(UNREAD_CAP)
  })

  it('clamps anything larger — the badge says 99+, not 1909', () => {
    expect(capUnread(UNREAD_CAP + 1)).toBe(UNREAD_CAP)
    expect(capUnread(1909)).toBe(UNREAD_CAP)
  })
})
