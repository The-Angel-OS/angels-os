/**
 * channel-deduplication — Unit Tests
 *
 * Tests the pure helper: getEssentialChannels
 * (Payload-dependent async functions are not tested here)
 */
import { describe, it, expect } from 'vitest'

import { getEssentialChannels } from '@/utilities/channel-deduplication'

describe('getEssentialChannels', () => {
  it('returns an array', () => {
    expect(Array.isArray(getEssentialChannels('tenant-1'))).toBe(true)
  })

  it('returns at least 2 essential channels', () => {
    const channels = getEssentialChannels('tenant-1')
    expect(channels.length).toBeGreaterThanOrEqual(2)
  })

  it('includes a "main" channel', () => {
    const channels = getEssentialChannels('tenant-1')
    expect(channels.some(c => c.name === 'main')).toBe(true)
  })

  it('includes a "system" channel', () => {
    const channels = getEssentialChannels('tenant-1')
    expect(channels.some(c => c.name === 'system')).toBe(true)
  })

  it('sets tenantId on all channels', () => {
    const tenantId = 'my-tenant'
    const channels = getEssentialChannels(tenantId)
    channels.forEach(c => {
      expect(c.tenantId).toBe(tenantId)
    })
  })

  it('marks channels as isSystem = true', () => {
    const channels = getEssentialChannels('t1')
    channels.forEach(c => {
      expect(c.isSystem).toBe(true)
    })
  })

  it('marks channels as active', () => {
    const channels = getEssentialChannels('t1')
    channels.forEach(c => {
      expect(c.status).toBe('active')
    })
  })

  it('channels have a channelType', () => {
    const channels = getEssentialChannels('t1')
    channels.forEach(c => {
      expect(typeof c.channelType).toBe('string')
    })
  })
})
