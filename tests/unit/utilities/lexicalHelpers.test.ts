/**
 * lexicalHelpers — Unit Tests
 *
 * Pure factory functions that build Lexical editor content structures.
 */
import { describe, it, expect } from 'vitest'

import {
  createLexicalContent,
  createTextNode,
  createParagraphNode,
  createHeadingNode,
  createListItemNode,
  createUnorderedListNode,
} from '@/utilities/lexicalHelpers'

describe('createTextNode', () => {
  it('creates a text node with the given text', () => {
    const node = createTextNode('Hello')
    expect(node.text).toBe('Hello')
    expect(node.type).toBe('text')
  })

  it('defaults format to 0', () => {
    expect(createTextNode('test').format).toBe(0)
  })

  it('accepts a custom format', () => {
    expect(createTextNode('bold', 1).format).toBe(1)
  })

  it('has correct shape fields', () => {
    const node = createTextNode('x')
    expect(node.version).toBe(1)
    expect(node.mode).toBe('normal')
    expect(node.detail).toBe(0)
  })
})

describe('createParagraphNode', () => {
  it('wraps text in a paragraph node', () => {
    const node = createParagraphNode('Hello world')
    expect(node.type).toBe('paragraph')
    expect(node.children).toHaveLength(1)
    expect(node.children[0].text).toBe('Hello world')
  })

  it('has correct structural fields', () => {
    const node = createParagraphNode('test')
    expect(node.direction).toBe('ltr')
    expect(node.version).toBe(1)
  })
})

describe('createHeadingNode', () => {
  it('creates an h2 by default', () => {
    const node = createHeadingNode('My Heading')
    expect(node.type).toBe('heading')
    expect(node.tag).toBe('h2')
    expect(node.children[0].text).toBe('My Heading')
  })

  it('accepts a custom tag', () => {
    const node = createHeadingNode('Title', 'h1')
    expect(node.tag).toBe('h1')
  })

  it('supports h3-h6 tags', () => {
    expect(createHeadingNode('Sub', 'h3').tag).toBe('h3')
    expect(createHeadingNode('Sub', 'h6').tag).toBe('h6')
  })
})

describe('createListItemNode', () => {
  it('creates a list item with paragraph children', () => {
    const node = createListItemNode('Item text')
    expect(node.type).toBe('listitem')
    expect(node.children).toHaveLength(1)
    expect(node.children[0].type).toBe('paragraph')
  })
})

describe('createUnorderedListNode', () => {
  it('creates a bullet list with the given items', () => {
    const node = createUnorderedListNode(['Alpha', 'Beta', 'Gamma'])
    expect(node.type).toBe('list')
    expect(node.listType).toBe('bullet')
    expect(node.tag).toBe('ul')
    expect(node.children).toHaveLength(3)
  })

  it('handles an empty items array', () => {
    const node = createUnorderedListNode([])
    expect(node.children).toHaveLength(0)
  })
})

describe('createLexicalContent', () => {
  it('wraps children in a root node', () => {
    const para = createParagraphNode('Hello')
    const content = createLexicalContent([para])
    expect(content.root.type).toBe('root')
    expect(content.root.children).toHaveLength(1)
    expect(content.root.children[0]).toEqual(para)
  })

  it('sets root direction and version', () => {
    const content = createLexicalContent([])
    expect(content.root.direction).toBe('ltr')
    expect(content.root.version).toBe(1)
  })

  it('accepts multiple children', () => {
    const children = [createParagraphNode('A'), createParagraphNode('B')]
    const content = createLexicalContent(children)
    expect(content.root.children).toHaveLength(2)
  })
})
