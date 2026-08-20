import { describe, it, expect } from 'vitest'
import {
  fillMetaFromContent,
  summarize,
  extractText,
} from '@/collections/Posts/hooks/fillMetaFromContent'

/** A Content block holding one paragraph, as the editor actually stores it. */
const block = (...paragraphs: string[]) => [
  {
    blockType: 'content',
    columns: [
      {
        richText: {
          root: {
            children: paragraphs.map((text) => ({
              type: 'paragraph',
              children: [{ type: 'text', text }],
            })),
          },
        },
      },
    ],
  },
]

// The hook's args are wider than what it reads; only `data` matters here.
const run = (data: Record<string, unknown>) =>
  (fillMetaFromContent as unknown as (a: { data: Record<string, unknown> }) => Record<string, unknown>)(
    { data },
  )

describe('extractText — finds prose wherever a block hid it', () => {
  it('walks nested blocks, columns and richText', () => {
    expect(extractText(block('Hello there', 'Second line')).join(' ')).toBe('Hello there Second line')
  })

  it.each([null, undefined, [], {}, 'a string', 42])('returns nothing for %j', (input) => {
    expect(extractText(input)).toEqual([])
  })

  it('stops collecting once it has enough', () => {
    const many = Array.from({ length: 200 }, (_, i) => `word${i}`)
    expect(extractText(block(...many)).join(' ').length).toBeLessThan(600)
  })
})

describe('summarize', () => {
  it('uses short bodies whole, with no ellipsis', () => {
    expect(summarize(block('A short post body.'))).toBe('A short post body.')
  })

  it('cuts long bodies at a word boundary', () => {
    const out = summarize(block('lorem ipsum dolor sit amet '.repeat(20)))
    expect(out.length).toBeLessThanOrEqual(156)
    expect(out.endsWith('…')).toBe(true)
    // Never ends mid-word before the ellipsis.
    expect(out.slice(0, -1)).not.toMatch(/\w-$/)
  })

  it('collapses the whitespace an editor leaves behind', () => {
    expect(summarize(block('one   two\n\nthree'))).toBe('one two three')
  })

  it('returns empty for an empty body', () => {
    expect(summarize([])).toBe('')
    expect(summarize(undefined)).toBe('')
  })
})

describe('fillMetaFromContent', () => {
  it('fills a blank description from the body', () => {
    const out = run({ title: 'T', layout: block('The van broke down in Palm Harbor.') })
    expect((out.meta as { description: string }).description).toBe(
      'The van broke down in Palm Harbor.',
    )
  })

  it("NEVER overwrites a description the author wrote", () => {
    const out = run({
      layout: block('Body text'),
      meta: { description: 'Mine', image: 7 },
    })
    expect((out.meta as { description: string }).description).toBe('Mine')
  })

  it('treats a whitespace-only description as blank', () => {
    const out = run({ layout: block('Body text'), meta: { description: '   ' } })
    expect((out.meta as { description: string }).description).toBe('Body text')
  })

  it('keeps the other meta fields when it fills one in', () => {
    const out = run({ layout: block('Body'), meta: { image: 42, title: 'Keep' } })
    expect(out.meta).toMatchObject({ image: 42, title: 'Keep', description: 'Body' })
  })

  it('leaves meta alone when there is no body to summarise', () => {
    const out = run({ title: 'T', layout: [] })
    expect(out.meta).toBeUndefined()
  })

  it('trims a title with a leading space', () => {
    expect(run({ title: ' 260427 8K Rollup Dunedin Marina', layout: [] }).title).toBe(
      '260427 8K Rollup Dunedin Marina',
    )
  })

  it('does not blank a title that is only whitespace', () => {
    // Better to let Payload's own required-check speak than to silently empty it.
    expect(run({ title: '   ', layout: [] }).title).toBe('   ')
  })

  it('survives a post with no data at all', () => {
    expect(run({})).toEqual({})
  })
})
