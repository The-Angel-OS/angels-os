/**
 * Where the "new since" divider lands.
 *
 * Getting this wrong is quiet: the line appears over your own message, or over
 * the bottom of a channel you have fully read, and it just looks like the app
 * is confused rather than like a bug anyone reports.
 */
import { describe, it, expect } from 'vitest'
import { firstUnreadId } from '@/components/ChatControl/MessageList'
import type { ChatMessage } from '@/components/ChatControl/types'

function msg(id: string, iso: string, authorId?: string): ChatMessage {
  return {
    id,
    role: 'user',
    content: id,
    timestamp: new Date(iso),
    ...(authorId ? { authorId } : {}),
  }
}

const MARK = '2026-08-24T10:00:00.000Z'

describe('firstUnreadId', () => {
  it('returns the first message newer than the mark', () => {
    const messages = [
      msg('a', '2026-08-24T09:00:00Z'),
      msg('b', '2026-08-24T11:00:00Z'),
      msg('c', '2026-08-24T12:00:00Z'),
    ]
    expect(firstUnreadId(messages, MARK)).toBe('b')
  })

  it('returns null when everything is already read', () => {
    // No line at all beats a line pinned to the bottom of every caught-up channel.
    const messages = [msg('a', '2026-08-24T08:00:00Z'), msg('b', '2026-08-24T09:00:00Z')]
    expect(firstUnreadId(messages, MARK)).toBeNull()
  })

  it('returns null with no mark — a channel never opened gets no divider', () => {
    expect(firstUnreadId([msg('a', '2026-08-24T11:00:00Z')], null)).toBeNull()
    expect(firstUnreadId([msg('a', '2026-08-24T11:00:00Z')], undefined)).toBeNull()
  })

  it('ignores an unparseable mark rather than dividing at message one', () => {
    expect(firstUnreadId([msg('a', '2026-08-24T11:00:00Z')], 'lunchtime')).toBeNull()
  })

  it('never opens the unread run on the viewer\'s OWN message', () => {
    // Sending something and coming back to "New" over your own words reads as
    // a bug, every time.
    const messages = [
      msg('mine', '2026-08-24T11:00:00Z', 'u1'),
      msg('theirs', '2026-08-24T11:30:00Z', 'u2'),
    ]
    expect(firstUnreadId(messages, MARK, 'u1')).toBe('theirs')
  })

  it('still divides on your own message when no viewer is known', () => {
    const messages = [msg('mine', '2026-08-24T11:00:00Z', 'u1')]
    expect(firstUnreadId(messages, MARK)).toBe('mine')
  })

  it('treats a message exactly at the mark as read', () => {
    // mark-read stores the timestamp of the newest message you saw, so that
    // message is by definition read. `>` not `>=`, or the divider sits one
    // message too early forever.
    const messages = [msg('a', MARK), msg('b', '2026-08-24T10:00:01Z')]
    expect(firstUnreadId(messages, MARK)).toBe('b')
  })

  it('survives a message with a broken timestamp', () => {
    const broken = { ...msg('bad', '2026-08-24T11:00:00Z'), timestamp: new Date('nope') }
    expect(firstUnreadId([broken, msg('good', '2026-08-24T12:00:00Z')], MARK)).toBe('good')
  })

  it('returns null for an empty list', () => {
    expect(firstUnreadId([], MARK)).toBeNull()
  })
})
