import { afterEach, describe, expect, it } from 'vitest'
import { getPortalDomainSuffix } from '@/utilities/getURL'

const orig = process.env.NEXT_PUBLIC_SERVER_URL

afterEach(() => {
  process.env.NEXT_PUBLIC_SERVER_URL = orig
})

describe('getPortalDomainSuffix', () => {
  it('derives the apex from the node server URL', () => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://payloadnuke.com'
    expect(getPortalDomainSuffix()).toBe('payloadnuke.com')
  })

  it('strips www/platform prefixes', () => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://www.spacesangels.com'
    expect(getPortalDomainSuffix()).toBe('spacesangels.com')
  })

  it('falls back to angelos.local for localhost / unset', () => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'http://localhost:3000'
    expect(getPortalDomainSuffix()).toBe('angelos.local')
    delete process.env.NEXT_PUBLIC_SERVER_URL
    expect(getPortalDomainSuffix()).toBe('angelos.local')
  })
})
