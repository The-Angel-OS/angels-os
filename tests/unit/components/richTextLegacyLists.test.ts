/**
 * Legacy Lexical list normalization — fixes "unknown node" / Lexical error #17
 * on content authored with the pre-3.x `unordered-list` / `ordered-list` node
 * types, which the current renderer doesn't register.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeLegacyLexicalNode,
  normalizeLegacyEditorState,
} from '@/components/RichText/normalizeLegacyLexical'

describe('normalizeLegacyLexicalNode', () => {
  it('rewrites unordered-list → list (bullet/ul)', () => {
    const out = normalizeLegacyLexicalNode({
      type: 'unordered-list',
      listType: 'bullet',
      children: [{ type: 'listitem', value: 1, children: [{ type: 'text', text: 'a' }] }],
    }) as any
    expect(out.type).toBe('list')
    expect(out.listType).toBe('bullet')
    expect(out.tag).toBe('ul')
    expect(out.children[0].type).toBe('listitem')
  })

  it('rewrites ordered-list → list (number/ol) and preserves start', () => {
    const out = normalizeLegacyLexicalNode({ type: 'ordered-list', start: 3, children: [] }) as any
    expect(out.type).toBe('list')
    expect(out.listType).toBe('number')
    expect(out.tag).toBe('ol')
    expect(out.start).toBe(3)
  })

  it('defaults ordered-list start to 1', () => {
    const out = normalizeLegacyLexicalNode({ type: 'ordered-list', children: [] }) as any
    expect(out.start).toBe(1)
  })

  it('leaves modern list nodes untouched', () => {
    const modern = { type: 'list', listType: 'bullet', tag: 'ul', children: [] }
    expect(normalizeLegacyLexicalNode(modern)).toEqual(modern)
  })

  it('recurses into nested legacy lists', () => {
    const out = normalizeLegacyLexicalNode({
      type: 'root',
      children: [
        {
          type: 'unordered-list',
          children: [
            {
              type: 'listitem',
              value: 1,
              children: [{ type: 'ordered-list', children: [] }],
            },
          ],
        },
      ],
    }) as any
    expect(out.children[0].type).toBe('list')
    expect(out.children[0].children[0].children[0].type).toBe('list')
    expect(out.children[0].children[0].children[0].listType).toBe('number')
  })

  it('passes through primitives and non-objects', () => {
    expect(normalizeLegacyLexicalNode(null as any)).toBeNull()
    expect(normalizeLegacyLexicalNode('text' as any)).toBe('text')
  })
})

describe('normalizeLegacyEditorState', () => {
  it('normalizes the root tree and returns a new object', () => {
    const data: any = {
      root: { type: 'root', children: [{ type: 'unordered-list', children: [] }] },
    }
    const out = normalizeLegacyEditorState(data) as any
    expect(out).not.toBe(data)
    expect(out.root.children[0].type).toBe('list')
  })

  it('returns the input unchanged when there is no root', () => {
    const data: any = { foo: 'bar' }
    expect(normalizeLegacyEditorState(data)).toBe(data)
  })
})
