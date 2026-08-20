import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Fill in the SEO description from the post's own body when the author left it
 * blank — and trim the title while we're here.
 *
 * The SEO tab has a "generate" button nobody presses. On 260820, nine of
 * Clearwater's fifteen posts had no meta description, which is what Facebook,
 * iMessage and Google show under the headline: every share Ken made was going
 * out with a blank line where the pitch should be. Config-free for the 99%
 * means the sensible thing happens without a settings screen.
 *
 * Only fills an EMPTY description. An author who wrote one keeps it, forever —
 * this never overwrites a human's words.
 *
 * Trimming the title fixes the other thing the same audit found: a post titled
 * " 260427 8K Rollup Dunedin Marina" with a leading space, which sorts wrong and
 * reads as a typo in every list it appears in.
 *
 * @see src/collections/Posts/index.ts
 */

/** Meta descriptions are truncated by search engines around 160 characters. */
const MAX_DESCRIPTION = 155

/**
 * Pull readable prose out of a Lexical richText tree.
 *
 * Depth-first over `children`, collecting `text` nodes. Deliberately structural
 * rather than a typed walk: the body is a blocks field holding several block
 * shapes, each with richText somewhere different, and a recursive scan handles
 * all of them without knowing any of their names.
 */
export function extractText(node: unknown, out: string[] = [], budget = 400): string[] {
  if (out.join(' ').length >= budget) return out
  if (Array.isArray(node)) {
    for (const child of node) extractText(child, out, budget)
    return out
  }
  if (!node || typeof node !== 'object') return out

  const n = node as Record<string, unknown>
  if (typeof n.text === 'string' && n.text.trim()) out.push(n.text.trim())
  for (const key of ['root', 'children', 'columns', 'richText', 'layout', 'content']) {
    if (n[key]) extractText(n[key], out, budget)
  }
  return out
}

/** First ~155 characters of real prose, cut at a word boundary. */
export function summarize(layout: unknown): string {
  const text = extractText(layout).join(' ').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= MAX_DESCRIPTION) return text

  const cut = text.slice(0, MAX_DESCRIPTION)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`
}

export const fillMetaFromContent: CollectionBeforeChangeHook = ({ data }) => {
  if (!data) return data

  if (typeof data.title === 'string') {
    const trimmed = data.title.trim()
    if (trimmed) data.title = trimmed
  }

  const meta = (data.meta ?? {}) as Record<string, unknown>
  const existing = typeof meta.description === 'string' ? meta.description.trim() : ''
  if (existing) return data

  const summary = summarize(data.layout)
  if (summary) data.meta = { ...meta, description: summary }

  return data
}
