import { describe, it, expect } from 'vitest'
import { buildBusMessageData, normalizeSpaceId } from '@/lib/busEnvelope'

const base = { space: 18, channel: 'node:clearwater-cruisin:Iam0', author: 153, tenant: 5 }

describe('busEnvelope contract', () => {
  it('always stores content as { text } (never a bare string → the 500 bug class)', () => {
    const d = buildBusMessageData({ ...base, text: 'hello' })
    expect(d.content).toEqual({ text: 'hello' })
  })

  it('coerces a string space id to a number (integer FK)', () => {
    const d = buildBusMessageData({ ...base, space: '18', text: 'x' })
    expect(d.space).toBe(18)
    expect(normalizeSpaceId('42')).toBe(42)
  })

  it('throws on a non-numeric space id', () => {
    expect(() => buildBusMessageData({ ...base, space: 'abc', text: 'x' })).toThrow(/invalid space/)
  })

  it('throws on a missing channel', () => {
    expect(() => buildBusMessageData({ ...base, channel: '', text: 'x' })).toThrow(/channel/)
  })

  it('throws on empty text with no attachments', () => {
    expect(() => buildBusMessageData({ ...base, text: '   ' })).toThrow(/empty/)
  })

  it('allows empty text when attachments are present', () => {
    const d = buildBusMessageData({ ...base, text: '', attachments: [{ media: 1 }] })
    expect(d.content).toEqual({ text: '' })
    expect(d.attachments).toHaveLength(1)
  })

  it('allows empty text when allowEmpty is set (two-phase callers)', () => {
    expect(() => buildBusMessageData({ ...base, text: '', allowEmpty: true })).not.toThrow()
  })

  it('merges kind into metadata.kind', () => {
    const d = buildBusMessageData({ ...base, text: 'x', kind: 'node-command', metadata: { requestId: 'r1' } })
    expect(d.metadata).toEqual({ requestId: 'r1', kind: 'node-command' })
  })

  it('defaults messageType=user and visibility=tenant', () => {
    const d = buildBusMessageData({ ...base, text: 'x' })
    expect(d.messageType).toBe('user')
    expect(d.visibility).toBe('tenant')
  })
})
