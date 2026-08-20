/**
 * markdownToLexical — turn the Markdown an LLM emits into real Lexical nodes.
 *
 * Leo writes in Markdown because that is what a language model writes. The old
 * converter split on blank lines and dropped each block into ONE plain text node,
 * so every post Leo produced arrived in the editor with its formatting still
 * showing as characters: `## Heading`, `**bold**`, `- item`, and bare `***`
 * separator lines sitting in the body. Ken hits this on every post he asks Leo to
 * write, which makes the whole content workflow feel unfinished.
 *
 * Scope is deliberately what an LLM actually emits, not all of CommonMark:
 *
 *   block   #..###### headings · - * + bullets · 1. ordered · > quote ·
 *           --- *** ___ separators (dropped — see below) · paragraphs
 *   inline  **bold** · *italic* / _italic_ · `code` · [text](url)
 *
 * A separator line is DROPPED rather than converted: the horizontal-rule node is
 * an optional Lexical feature, and emitting one the editor's config doesn't know
 * about is worse than the blank it was standing in for. Anything else unmatched
 * survives as plain text — never as a thrown error, because a post that half
 * formats still beats a post that fails to save.
 *
 * ponytail: hand-rolled, no markdown dependency. This handles what Leo writes;
 * reach for a real parser only if someone needs tables, footnotes, or nested lists.
 *
 * @see src/utilities/lexicalHelpers.ts — the node constructors used elsewhere
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Lexical text-format bitmask. */
const BOLD = 1
const ITALIC = 2
const CODE = 16

const textNode = (text: string, format = 0): any => ({
  type: 'text',
  text,
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  version: 1,
})

const linkNode = (text: string, url: string, format = 0): any => ({
  type: 'link',
  children: [textNode(text, format)],
  direction: 'ltr',
  fields: { linkType: 'custom', newTab: !url.startsWith('/'), url },
  format: '',
  indent: 0,
  version: 3,
})

const block = (type: string, children: any[], extra: Record<string, unknown> = {}): any => ({
  type,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  ...extra,
})

/**
 * Split one line of Markdown into text/link nodes.
 *
 * One regex pass, first-match-wins, so `**bold**` is not re-scanned for the `*`
 * that would make it italic. Unbalanced markers (a lone `*`) simply never match
 * and stay as the literal character the author typed.
 */
export function inlineToNodes(line: string): any[] {
  const pattern = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g
  const nodes: any[] = []
  let last = 0
  let m: RegExpExecArray | null

  while ((m = pattern.exec(line)) !== null) {
    if (m.index > last) nodes.push(textNode(line.slice(last, m.index)))
    if (m[2] != null) nodes.push(textNode(m[2], BOLD))
    else if (m[4] != null) nodes.push(textNode(m[4], ITALIC))
    else if (m[5] != null) nodes.push(textNode(m[5], CODE))
    else if (m[6] != null && m[7] != null) nodes.push(linkNode(m[6], m[7]))
    last = m.index + m[0].length
  }
  if (last < line.length) nodes.push(textNode(line.slice(last)))

  return nodes.length ? nodes : [textNode('')]
}

const HEADING = /^(#{1,6})\s+(.*)$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const ORDERED = /^\s*\d+[.)]\s+(.*)$/
const QUOTE = /^>\s?(.*)$/
/** `---`, `***`, `___` — three or more of one marker, nothing else on the line. */
const SEPARATOR = /^\s*([-*_])\s*(?:\1\s*){2,}$/

const listItem = (text: string): any =>
  block('listitem', inlineToNodes(text), { value: 1 })

const listNode = (items: string[], ordered: boolean): any =>
  block(
    'list',
    items.map((t, i) => ({ ...listItem(t), value: i + 1 })),
    { listType: ordered ? 'number' : 'bullet', start: 1, tag: ordered ? 'ol' : 'ul' },
  )

/**
 * Convert Markdown to a Lexical richText root.
 *
 * Safe on empty input: returns a single empty paragraph, which is what the editor
 * expects for "no content" and what Payload validates against.
 */
export function markdownToLexical(markdown: string): any {
  const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n')
  const children: any[] = []

  // Buffers for the two constructs that span consecutive lines.
  let paragraph: string[] = []
  let list: { items: string[]; ordered: boolean } | null = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    children.push(block('paragraph', inlineToNodes(paragraph.join(' '))))
    paragraph = []
  }
  const flushList = () => {
    if (!list) return
    children.push(listNode(list.items, list.ordered))
    list = null
  }
  const flushAll = () => {
    flushParagraph()
    flushList()
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (!line.trim()) {
      flushAll()
      continue
    }
    if (SEPARATOR.test(line)) {
      // Dropped on purpose — a bare `***` in the body is the bug being fixed.
      flushAll()
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      flushAll()
      children.push(
        block('heading', inlineToNodes(heading[2]!.trim()), {
          tag: `h${Math.min(6, heading[1]!.length)}`,
        }),
      )
      continue
    }

    const quote = QUOTE.exec(line)
    if (quote) {
      flushAll()
      children.push(block('quote', inlineToNodes(quote[1]!)))
      continue
    }

    const bullet = BULLET.exec(line)
    const ordered = ORDERED.exec(line)
    if (bullet || ordered) {
      flushParagraph()
      const isOrdered = Boolean(ordered)
      const text = (bullet?.[1] ?? ordered?.[1] ?? '').trim()
      // A change of list style starts a new list rather than mixing markers.
      if (list && list.ordered !== isOrdered) flushList()
      if (!list) list = { items: [], ordered: isOrdered }
      list.items.push(text)
      continue
    }

    flushList()
    paragraph.push(line.trim())
  }
  flushAll()

  if (!children.length) children.push(block('paragraph', [textNode('')]))

  return {
    root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 },
  }
}
