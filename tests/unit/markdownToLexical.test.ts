import { describe, it, expect } from 'vitest'
import { markdownToLexical, inlineToNodes } from '@/utilities/markdownToLexical'

const kids = (md: string) => markdownToLexical(md).root.children
/** Every text string in a node tree, so we can assert nothing leaked as literal. */
const allText = (node: any): string =>
  node.text ?? (node.children || []).map(allText).join('')

describe('markdownToLexical — what Leo writes must not show as characters', () => {
  it('turns # headings into heading nodes with the right tag', () => {
    const [h1, h3] = kids('# Big\n\n### Small')
    expect(h1.type).toBe('heading')
    expect(h1.tag).toBe('h1')
    expect(allText(h1)).toBe('Big')
    expect(h3.tag).toBe('h3')
  })

  it('DROPS a bare *** separator instead of printing it', () => {
    const out = kids('One\n\n***\n\nTwo')
    expect(out).toHaveLength(2)
    expect(out.map(allText)).toEqual(['One', 'Two'])
    expect(JSON.stringify(out)).not.toContain('***')
  })

  it.each(['---', '***', '___', '- - -'])('drops the %s separator', (sep) => {
    expect(kids(`A\n\n${sep}\n\nB`)).toHaveLength(2)
  })

  it('builds a bullet list, not a paragraph of dashes', () => {
    const [list] = kids('- one\n- two\n- three')
    expect(list.type).toBe('list')
    expect(list.listType).toBe('bullet')
    expect(list.children).toHaveLength(3)
    expect(allText(list.children[0])).toBe('one')
  })

  it('builds an ordered list and numbers the items', () => {
    const [list] = kids('1. first\n2. second')
    expect(list.listType).toBe('number')
    expect(list.children.map((c: any) => c.value)).toEqual([1, 2])
  })

  it('starts a new list when the marker style changes', () => {
    const out = kids('- a\n1. b')
    expect(out.map((n: any) => n.listType)).toEqual(['bullet', 'number'])
  })

  it('formats **bold**, *italic* and `code` as marks, not asterisks', () => {
    const nodes = inlineToNodes('a **b** c *d* e `f`')
    expect(nodes.find((n) => n.text === 'b')?.format).toBe(1)
    expect(nodes.find((n) => n.text === 'd')?.format).toBe(2)
    expect(nodes.find((n) => n.text === 'f')?.format).toBe(16)
    expect(nodes.map((n) => n.text).join('')).not.toContain('*')
  })

  it('does not re-read **bold** as italic', () => {
    const nodes = inlineToNodes('**strong**')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].format).toBe(1)
  })

  it('leaves an unbalanced marker alone', () => {
    expect(inlineToNodes('2 * 3 = 6').map((n) => n.text).join('')).toBe('2 * 3 = 6')
  })

  it('makes a real link node out of [text](url)', () => {
    const [link] = inlineToNodes('[Book now](/book)')
    expect(link.type).toBe('link')
    expect(link.fields).toMatchObject({ linkType: 'custom', url: '/book', newTab: false })
    expect(allText(link)).toBe('Book now')
  })

  it('opens an external link in a new tab', () => {
    const [link] = inlineToNodes('[Site](https://example.com)')
    expect(link.fields.newTab).toBe(true)
  })

  it('joins wrapped lines into one paragraph and splits on blank lines', () => {
    const out = kids('one\ntwo\n\nthree')
    expect(out).toHaveLength(2)
    expect(allText(out[0])).toBe('one two')
  })

  it('handles a quote line', () => {
    const [q] = kids('> hello')
    expect(q.type).toBe('quote')
    expect(allText(q)).toBe('hello')
  })

  it.each(['', '   ', '\n\n'])('returns one empty paragraph for %j', (md) => {
    const out = kids(md)
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('paragraph')
    expect(allText(out[0])).toBe('')
  })

  it('survives a realistic Leo post without leaking markup', () => {
    const md = [
      '# Clearwater Cruisin',
      '',
      'We ride **every Sunday**.',
      '',
      '***',
      '',
      '## What to bring',
      '- water',
      '- a helmet',
      '',
      'See the [schedule](/events).',
    ].join('\n')
    const json = JSON.stringify(markdownToLexical(md))
    for (const leak of ['***', '**every', '## ', '# Clear', '- water', '](/events)']) {
      expect(json).not.toContain(leak)
    }
  })
})
