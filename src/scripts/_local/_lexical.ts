/**
 * The five lexical shapes a conform script actually needs.
 *
 * Payload's richText is a nested JSON tree, and hand-writing one inline is how a
 * content script ends up 300 lines of punctuation. Extracted on the second page
 * that needed it, not the first.
 */
export const t = (text: string) => ({
  mode: 'normal', text, type: 'text', style: '', detail: 0, format: 0, version: 1,
})

export const h = (tag: 'h2' | 'h3' | 'h4', text: string) => ({
  tag, type: 'heading', format: '', indent: 0, version: 1, children: [t(text)], direction: 'ltr',
})

export const p = (text: string) => ({
  type: 'paragraph', format: '', indent: 0, version: 1, children: [t(text)], direction: 'ltr',
})

export const bullets = (items: string[]) => ({
  tag: 'ul', type: 'list', listType: 'bullet', start: 1, format: '', indent: 0, version: 1,
  direction: 'ltr',
  children: items.map((item, i) => ({
    type: 'listitem', value: i + 1, format: '', indent: 0, version: 1,
    children: [t(item)], direction: 'ltr',
  })),
})

export const rich = (children: unknown[]) => ({
  root: { type: 'root', format: '', indent: 0, version: 1, children, direction: 'ltr' },
})

export const column = (size: 'half' | 'full', children: unknown[]) => ({
  size, richText: rich(children), enableLink: false,
})
