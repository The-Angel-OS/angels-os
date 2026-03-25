/**
 * Truncate long history messages to prevent context bloat.
 *
 * Used by both leo-stream.ts and ConversationEngine.ts when building
 * the conversation history sent to Claude. Tool results echoed back
 * as messages can be thousands of characters — this caps them to
 * preserve context window for the actual conversation.
 */

export const MAX_HISTORY_MESSAGE_CHARS = 2000
export const TRUNCATION_SUFFIX = '\n\n[...truncated for context efficiency]'

export function truncateHistoryMessage(content: string): string {
  if (content.length > MAX_HISTORY_MESSAGE_CHARS) {
    return content.slice(0, MAX_HISTORY_MESSAGE_CHARS) + TRUNCATION_SUFFIX
  }
  return content
}
