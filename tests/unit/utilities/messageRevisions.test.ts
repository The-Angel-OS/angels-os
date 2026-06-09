/**
 * messageRevisions — append-only, tamper-resistant message edit history.
 */
import { describe, it, expect } from 'vitest'
import { appendRevision, contentsDiffer, type RevisionMeta } from '@/utilities/messageRevisions'

const T1 = '2026-06-09T18:00:00.000Z'
const T2 = '2026-06-09T18:05:00.000Z'

describe('contentsDiffer', () => {
  it('detects string + JSON content changes', () => {
    expect(contentsDiffer('a', 'b')).toBe(true)
    expect(contentsDiffer('a', 'a')).toBe(false)
    expect(contentsDiffer({ text: 'x' }, { text: 'y' })).toBe(true)
    expect(contentsDiffer({ text: 'x' }, { text: 'x' })).toBe(false)
  })
})

describe('appendRevision', () => {
  it('first edit records the prior content as revision[0]', () => {
    const meta = appendRevision({}, [], { previousContent: 'original', editedBy: 7, moderation: false, now: T1 })
    expect(meta.edited).toBe(true)
    expect(meta.editedAt).toBe(T1)
    expect(meta.editedBy).toBe(7)
    expect(meta.revisions).toEqual([{ content: 'original', editedAt: T1, editedBy: 7 }])
    expect(meta.moderated).toBeUndefined()
  })

  it('subsequent edits append (ad infinitum), preserving order', () => {
    const after1 = appendRevision({}, [], { previousContent: 'v1', editedBy: 7, moderation: false, now: T1 })
    const after2 = appendRevision(after1, after1.revisions, { previousContent: 'v2', editedBy: 7, moderation: false, now: T2 })
    expect(after2.revisions).toEqual([
      { content: 'v1', editedAt: T1, editedBy: 7 },
      { content: 'v2', editedAt: T2, editedBy: 7 },
    ])
  })

  it('an edit by a non-author is flagged as moderation', () => {
    const meta = appendRevision({}, [], { previousContent: 'orig', editedBy: 99, moderation: true, now: T1 })
    expect(meta.moderated).toBe(true)
    expect(meta.revisions?.[0]).toMatchObject({ moderation: true, editedBy: 99 })
  })

  it('is TAMPER-RESISTANT: client-supplied revisions are ignored; the server history wins', () => {
    const forged: RevisionMeta = { revisions: [{ content: 'forged', editedAt: T1, editedBy: 1 }] }
    const serverHistory = [{ content: 'real-v1', editedAt: T1, editedBy: 7 }]
    const meta = appendRevision(forged, serverHistory, { previousContent: 'real-v2', editedBy: 7, moderation: false, now: T2 })
    // Forged entry is gone; the real server history + the new revision remain.
    expect(meta.revisions).toEqual([
      { content: 'real-v1', editedAt: T1, editedBy: 7 },
      { content: 'real-v2', editedAt: T2, editedBy: 7 },
    ])
  })

  it('preserves other metadata keys (intent, conversationId, …)', () => {
    const meta = appendRevision(
      { conversationId: 'c1', intent: 'greeting' },
      [],
      { previousContent: 'orig', editedBy: 7, moderation: false, now: T1 },
    )
    expect(meta.conversationId).toBe('c1')
    expect(meta.intent).toBe('greeting')
    expect(meta.edited).toBe(true)
  })
})
