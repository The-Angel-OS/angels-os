import { describe, it, expect } from 'vitest'
import { nodeChannelSlug, parseNodeChannelSlug } from '@/utilities/nodeBus'

describe('parseNodeChannelSlug', () => {
  it('parses a canonical node channel slug', () => {
    expect(parseNodeChannelSlug('node:clearwater:merlin-01')).toEqual({
      endeavor: 'clearwater',
      nodeId: 'merlin-01',
    })
  })

  it('round-trips with nodeChannelSlug', () => {
    const slug = nodeChannelSlug('kendev', 'node-abc')
    expect(parseNodeChannelSlug(slug)).toEqual({ endeavor: 'kendev', nodeId: 'node-abc' })
  })

  it('preserves a nodeId that itself contains colons (splits on first colon only)', () => {
    expect(parseNodeChannelSlug('node:clearwater:merlin:cam:2')).toEqual({
      endeavor: 'clearwater',
      nodeId: 'merlin:cam:2',
    })
  })

  it('returns null for non-node channels', () => {
    expect(parseNodeChannelSlug('leo')).toBeNull()
    expect(parseNodeChannelSlug('general')).toBeNull()
    expect(parseNodeChannelSlug('dm-5-leo')).toBeNull()
  })

  it('returns null for malformed node slugs', () => {
    expect(parseNodeChannelSlug('node:')).toBeNull()
    expect(parseNodeChannelSlug('node:clearwater')).toBeNull() // no nodeId separator
    expect(parseNodeChannelSlug('node:clearwater:')).toBeNull() // empty nodeId
    expect(parseNodeChannelSlug('node::merlin-01')).toBeNull() // empty endeavor
  })

  it('returns null for non-string input', () => {
    expect(parseNodeChannelSlug(undefined)).toBeNull()
    expect(parseNodeChannelSlug(null)).toBeNull()
    expect(parseNodeChannelSlug(42)).toBeNull()
  })
})
