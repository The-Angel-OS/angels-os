import { describe, it, expect } from 'vitest'
import { canQueryMessages } from '@/components/ChatControl/useChat'

/**
 * The regression this guards: a DM's slug is never in the ACTIVE SPACE's channel
 * list, because a DM lives in the AI Bus. Checking `channels` alone meant no DM
 * ever loaded its history — while sending still worked, since that path appends
 * locally and LEO answers over the stream. Hence "messages disappear when I
 * navigate back", which was really "messages never loaded in the first place".
 */

const SPACE_CHANNELS = ['announcements', 'main', 'support']
const DMS = ['dm-15-3', 'dm-3-leo']
const CATCH_ALL = 'catch-all'

const can = (active: string) => canQueryMessages(active, SPACE_CHANNELS, DMS, CATCH_ALL)

describe('canQueryMessages', () => {
  it('loads a DM even though its slug is not in the active space', () => {
    expect(can('dm-15-3')).toBe(true)
    expect(can('dm-3-leo')).toBe(true)
  })

  it('still loads an ordinary channel of the active space', () => {
    for (const slug of SPACE_CHANNELS) expect(can(slug)).toBe(true)
  })

  it('still refuses an unresolved deep-link channel ID', () => {
    // The reason the gate exists: Messages.channel stores a SLUG, so querying
    // channel=808 returns nothing and triggers the double-load.
    expect(can('808')).toBe(false)
  })

  it('refuses a channel from some other space', () => {
    expect(can('gotify')).toBe(false)
  })

  it('lets the Catch-All pseudo-channel through — it is in no list by design', () => {
    expect(can(CATCH_ALL)).toBe(true)
  })

  it('refuses an empty channel', () => {
    expect(can('')).toBe(false)
  })

  it('accepts a Set as well as an array for the DM slugs', () => {
    expect(canQueryMessages('dm-15-3', SPACE_CHANNELS, new Set(DMS), CATCH_ALL)).toBe(true)
    expect(canQueryMessages('dm-99-1', SPACE_CHANNELS, new Set(DMS), CATCH_ALL)).toBe(false)
  })

  it('is false when the user has no DMs at all', () => {
    expect(canQueryMessages('dm-15-3', SPACE_CHANNELS, [], CATCH_ALL)).toBe(false)
  })
})
