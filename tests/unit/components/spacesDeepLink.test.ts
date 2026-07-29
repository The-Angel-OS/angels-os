import { describe, it, expect } from 'vitest'
import { parseSpacesDeepLink } from '@/components/ChatControl/deepLink'

/**
 * 260728: this parser is now read on EVERY pathname change, not just at mount.
 * ChatProvider used to capture the deep link once — but moving between spaces is
 * client-side routing, so the provider never unmounts and the URL and the
 * selector drifted apart (the sidebar showed the persisted LEO DM instead of the
 * channel on screen). The pathname effect keys on exactly these return values.
 */
describe('parseSpacesDeepLink', () => {
  it('parses space + channel id from the canonical deep link', () => {
    expect(parseSpacesDeepLink('/dashboard/spaces/5/247')).toEqual({
      spaceId: '5',
      channelToken: '247',
    })
  })

  it('parses a space-only deep link (no channel)', () => {
    expect(parseSpacesDeepLink('/dashboard/spaces/5')).toEqual({
      spaceId: '5',
      channelToken: null,
    })
  })

  it('accepts a legacy slug channel token', () => {
    expect(parseSpacesDeepLink('/dashboard/spaces/5/general')).toEqual({
      spaceId: '5',
      channelToken: 'general',
    })
  })

  it('tolerates a locale prefix', () => {
    expect(parseSpacesDeepLink('/es/dashboard/spaces/12/88')).toEqual({
      spaceId: '12',
      channelToken: '88',
    })
  })

  it('ignores trailing query/hash on the channel token', () => {
    expect(parseSpacesDeepLink('/dashboard/spaces/5/247?msg=9#x')).toEqual({
      spaceId: '5',
      channelToken: '247',
    })
  })

  it('decodes an encoded channel token', () => {
    expect(parseSpacesDeepLink('/dashboard/spaces/5/page%3Aabout')).toEqual({
      spaceId: '5',
      channelToken: 'page:about',
    })
  })

  it('returns null for non-spaces paths and empty input', () => {
    expect(parseSpacesDeepLink('/dashboard/leo')).toBeNull()
    expect(parseSpacesDeepLink('/dashboard/spaces')).toBeNull()
    expect(parseSpacesDeepLink('')).toBeNull()
    expect(parseSpacesDeepLink(null)).toBeNull()
    expect(parseSpacesDeepLink(undefined)).toBeNull()
  })
})
