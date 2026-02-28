/**
 * Discord message formatter — converts LEO's markdown to Discord-compatible format.
 *
 * Discord supports a subset of markdown: **bold**, *italic*, `code`, ```code blocks```,
 * > blockquotes, [masked links](url), and some limited formatting.
 * It does NOT support: # headings, HTML tags, or images in markdown.
 *
 * Also handles Discord's 2000 character message limit by splitting long messages
 * at clean boundaries.
 */

/**
 * Convert LEO's markdown to Discord-compatible markdown.
 *
 * Transforms:
 * - # Heading → **Heading** (bold)
 * - ## Heading → **Heading**
 * - ### Heading → **Heading**
 * - Preserves code blocks, bold, italic, links, lists
 * - Strips HTML tags
 * - Preserves emoji
 */
export function formatForDiscord(text: string): string {
  if (!text) return ''

  let result = text

  // Preserve code blocks by temporarily replacing them
  const codeBlocks: string[] = []
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match)
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`
  })

  // Preserve inline code
  const inlineCode: string[] = []
  result = result.replace(/`[^`]+`/g, (match) => {
    inlineCode.push(match)
    return `__INLINE_CODE_${inlineCode.length - 1}__`
  })

  // Convert markdown headings to bold text
  // # Heading → **Heading**
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '**$1**')

  // Strip HTML tags (Discord doesn't render them)
  result = result.replace(/<[^>]+>/g, '')

  // Restore code blocks and inline code
  result = result.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[Number(i)] || '')
  result = result.replace(/__INLINE_CODE_(\d+)__/g, (_, i) => inlineCode[Number(i)] || '')

  // Clean up excessive blank lines (max 2 consecutive)
  result = result.replace(/\n{3,}/g, '\n\n')

  return result.trim()
}

/**
 * Split a message into chunks that fit Discord's character limit.
 *
 * Split priority:
 * 1. Paragraph boundaries (\n\n)
 * 2. Line boundaries (\n)
 * 3. Sentence boundaries (. ! ?)
 * 4. Hard split at max length
 */
export function splitMessage(text: string, max: number = 2000): string[] {
  if (!text) return []
  if (text.length <= max) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= max) {
      chunks.push(remaining)
      break
    }

    let splitAt = -1

    // Try paragraph boundary
    const paragraphEnd = remaining.lastIndexOf('\n\n', max)
    if (paragraphEnd > max * 0.3) {
      splitAt = paragraphEnd
    }

    // Try line boundary
    if (splitAt === -1) {
      const lineEnd = remaining.lastIndexOf('\n', max)
      if (lineEnd > max * 0.3) {
        splitAt = lineEnd
      }
    }

    // Try sentence boundary
    if (splitAt === -1) {
      // Look for sentence-ending punctuation followed by space
      const searchRange = remaining.substring(0, max)
      const sentenceMatch = searchRange.match(/[.!?]\s+(?=[A-Z])/g)
      if (sentenceMatch) {
        const lastSentenceEnd = searchRange.lastIndexOf(sentenceMatch[sentenceMatch.length - 1])
        if (lastSentenceEnd > max * 0.3) {
          splitAt = lastSentenceEnd + sentenceMatch[sentenceMatch.length - 1].length - 1
        }
      }
    }

    // Hard split as last resort
    if (splitAt === -1) {
      // Try to split at a space
      const spaceAt = remaining.lastIndexOf(' ', max)
      splitAt = spaceAt > max * 0.3 ? spaceAt : max
    }

    chunks.push(remaining.substring(0, splitAt).trim())
    remaining = remaining.substring(splitAt).trim()
  }

  return chunks.filter((c) => c.length > 0)
}

/**
 * Truncate text with ellipsis at a clean boundary.
 * Useful for Discord embed descriptions (max 4096) or field values (max 1024).
 */
export function truncateWithEllipsis(text: string, max: number): string {
  if (!text) return ''
  if (text.length <= max) return text

  // Leave room for ellipsis
  const truncated = text.substring(0, max - 3)

  // Try to break at a word boundary
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > max * 0.5) {
    return truncated.substring(0, lastSpace) + '...'
  }

  return truncated + '...'
}
