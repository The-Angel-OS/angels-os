/**
 * assembleHistoryTurns — multi-user channel attribution.
 * Regression guard for the "LEO greeted Tyler as Kenneth" identity bug: human
 * turns must be labeled by speaker and never merged across different authors.
 */
import { describe, it, expect } from 'vitest'
import { assembleHistoryTurns, turnEchoesUserMessage, type RawHistoryTurn } from '@/utilities/assembleHistoryTurns'

const human = (authorName: string, content: string): RawHistoryTurn => ({ isSystem: false, authorName, content })
const agent = (content: string): RawHistoryTurn => ({ isSystem: true, authorName: '', content })

describe('assembleHistoryTurns', () => {
  it('labels each human turn with its speaker', () => {
    const out = assembleHistoryTurns([human('Kenneth', 'hello'), agent('hi Kenneth')])
    expect(out).toEqual([
      { role: 'user', content: 'Kenneth: hello' },
      { role: 'assistant', content: 'hi Kenneth' },
    ])
  })

  it('does NOT merge consecutive turns from DIFFERENT authors', () => {
    // The core bug: Kenneth's history + Tyler's new turn must stay distinct.
    const out = assembleHistoryTurns([human('Kenneth', 'how are things'), human('Tyler', 'hi leo')])
    expect(out).toEqual([
      { role: 'user', content: 'Kenneth: how are things' },
      { role: 'user', content: 'Tyler: hi leo' },
    ])
  })

  it('merges consecutive turns from the SAME author (no repeated label)', () => {
    const out = assembleHistoryTurns([human('Tyler', 'line one'), human('Tyler', 'line two')])
    expect(out).toEqual([{ role: 'user', content: 'Tyler: line one\nline two' }])
  })

  it('collapses consecutive assistant turns into one (no speaker label)', () => {
    const out = assembleHistoryTurns([agent('part a'), agent('part b')])
    expect(out).toEqual([{ role: 'assistant', content: 'part a\npart b' }])
  })

  it('skips empty / whitespace-only turns', () => {
    const out = assembleHistoryTurns([human('Tyler', '   '), human('Tyler', 'real')])
    expect(out).toEqual([{ role: 'user', content: 'Tyler: real' }])
  })

  it('falls back to "User" when an author name is missing', () => {
    const out = assembleHistoryTurns([{ isSystem: false, authorName: '', content: 'anon' }])
    expect(out).toEqual([{ role: 'user', content: 'User: anon' }])
  })

  it('interleaves a real multi-user thread correctly', () => {
    const out = assembleHistoryTurns([
      human('Kenneth', 'hey leo'),
      agent('Hello Kenneth!'),
      human('Tyler', 'hi leo'),
    ])
    expect(out).toEqual([
      { role: 'user', content: 'Kenneth: hey leo' },
      { role: 'assistant', content: 'Hello Kenneth!' },
      { role: 'user', content: 'Tyler: hi leo' },
    ])
    // Tyler's turn is its own labeled message — LEO can now address Tyler, not Kenneth.
    expect(out[out.length - 1].content).toBe('Tyler: hi leo')
  })
})

describe('turnEchoesUserMessage (leo-stream split-brain echo guard)', () => {
  it('matches an attributed history turn against the raw user message (the PlasmaPlasma bug)', () => {
    expect(turnEchoesUserMessage('Kenneth Courtney: Plasma', 'Plasma')).toBe(true)
  })
  it('matches an unattributed/exact turn (DM-style)', () => {
    expect(turnEchoesUserMessage('Plasma', 'Plasma')).toBe(true)
  })
  it('matches a same-author merged turn (last line)', () => {
    expect(turnEchoesUserMessage('Kenneth: earlier line\nPlasma', 'Plasma')).toBe(true)
  })
  it('does NOT match a different message', () => {
    expect(turnEchoesUserMessage('Kenneth: Photon', 'Plasma')).toBe(false)
  })
  it('handles surrounding whitespace + ignores empty user messages', () => {
    expect(turnEchoesUserMessage('Kenneth: Plasma ', '  Plasma  ')).toBe(true)
    expect(turnEchoesUserMessage('Kenneth: ', '')).toBe(false)
  })
  it('is safe on non-string content', () => {
    expect(turnEchoesUserMessage(undefined, 'Plasma')).toBe(false)
  })
})
