/**
 * assembleHistoryTurns — collapse a chronological list of message turns into
 * Anthropic-style {role, content} for LEO's context window.
 *
 * The load-bearing rule: HUMAN turns are attributed by speaker name and only
 * merged with consecutive turns from the SAME author. Without this, a multi-user
 * channel's history flattens every person into one anonymous "user" voice, and
 * LEO parrots whichever name dominates — the "LEO greeted Tyler as Kenneth" bug.
 * System / AI-agent turns collapse to a single 'assistant' voice (no name).
 *
 * Pure: callers do the IO (fetch + extract text + truncate) and hand us the
 * already-prepared turns, so this is trivially testable.
 */
export interface RawHistoryTurn {
  /** True for system / AI-agent authored messages → 'assistant'. */
  isSystem: boolean
  /** Display name of a human author (ignored when isSystem). */
  authorName: string
  /** Already extracted + truncated text; empty turns are skipped. */
  content: string
}

export interface HistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

export function assembleHistoryTurns(turns: RawHistoryTurn[]): HistoryTurn[] {
  const out: HistoryTurn[] = []
  let lastUserAuthor: string | null = null

  for (const t of turns) {
    const content = t.content
    if (!content.trim()) continue

    if (!t.isSystem) {
      const name = t.authorName || 'User'
      const last = out[out.length - 1]
      if (last && last.role === 'user' && lastUserAuthor === name) {
        last.content = `${last.content}\n${content}`
      } else {
        out.push({ role: 'user', content: `${name}: ${content}` })
      }
      lastUserAuthor = name
    } else {
      const last = out[out.length - 1]
      if (last && last.role === 'assistant') {
        last.content = `${last.content}\n${content}`
      } else {
        out.push({ role: 'assistant', content })
      }
      lastUserAuthor = null
    }
  }

  return out
}

/**
 * True when a history turn is the SAME as the just-sent user message — robust to
 * the speaker-attribution prefix this module adds (`"${name}: ${content}"`) and to
 * same-author turn merging (`"${name}: a\nb"`).
 *
 * leo-stream persists the user's message to the channel BEFORE calling the model,
 * so fetchConversationHistory already includes it; the model code only appends the
 * current turn when it's NOT already the last history entry. The naive check
 * (`lastTurn.content === userMessage`) silently broke once human turns gained the
 * `"Name: "` prefix — in any attributed (multi-user) channel the strings never
 * matched, so the turn was appended on top of the persisted copy and the model saw
 * it TWICE → LEO replied to "PlasmaPlasma" / "echoed twice". This comparison closes
 * that gap. See leo-stream.ts split-brain guards.
 */
export function turnEchoesUserMessage(turnContent: unknown, userMessage: string): boolean {
  if (typeof turnContent !== 'string') return false
  const c = turnContent.trim()
  const u = userMessage.trim()
  if (!u) return false
  // exact (unattributed/DM), `"Name: msg"` (attributed), or `"...\nmsg"` (merged).
  return c === u || c.endsWith(`: ${u}`) || c.endsWith(`\n${u}`)
}
