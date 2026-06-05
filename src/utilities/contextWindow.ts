/**
 * contextWindow — token-aware conversation history assembly for LEO.
 *
 * The old approach kept a fixed *count* of turns (12), which both overflowed the
 * window on long messages and under-used it on short ones. This budgets the
 * history by estimated tokens instead: keep the most recent messages, dropping
 * the oldest first, until a token budget is reached. Short chats keep more turns;
 * long ones never blow the window.
 *
 * Zero dependencies — pure + testable.
 */

/** Conservative token estimate (~4 chars/token for English prose; rounds up). */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

/** Total estimated tokens across a message list (string content only). */
export function estimateMessagesTokens<T extends { content: unknown }>(messages: T[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(typeof m.content === 'string' ? m.content : ''), 0)
}

/**
 * Trim a *chronological* message list to fit a token budget, dropping the OLDEST
 * messages first. Always keeps at least the most recent message (even if it alone
 * exceeds the budget). Ensures the result starts with a 'user' message (Anthropic
 * requires the first message to be 'user').
 */
export function trimToTokenBudget<T extends { role: 'user' | 'assistant'; content: unknown }>(
  messages: T[],
  budgetTokens: number,
): T[] {
  if (messages.length === 0) return messages
  let total = 0
  const keptReversed: T[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const cost = estimateTokens(typeof messages[i].content === 'string' ? (messages[i].content as string) : '')
    if (keptReversed.length > 0 && total + cost > budgetTokens) break
    total += cost
    keptReversed.push(messages[i])
  }
  const kept = keptReversed.reverse()
  while (kept.length > 0 && kept[0].role !== 'user') kept.shift()
  return kept
}
