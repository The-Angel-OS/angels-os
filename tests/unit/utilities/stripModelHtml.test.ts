import { describe, it, expect } from 'vitest'
import { stripModelHtml, looksLikeHtml } from '@/utilities/stripModelHtml'

describe('stripModelHtml', () => {
  it('leaves plain text and real markdown untouched', () => {
    const md = '# Title\n\nSome **bold** text.\n\n- one\n- two'
    expect(stripModelHtml(md)).toBe(md)
    expect(looksLikeHtml(md)).toBe(false)
  })

  it('converts the post LEO actually produced (post 98)', () => {
    const html =
      'We are thrilled to officially introduce the <strong>Where Did Everyone Go</strong> portal.</p>' +
      '<p>This endeavor is built to be a central hub. We are preparing to bind our official URL: ' +
      '<strong>wheredideveryonego.net</strong>.</p>'
    const out = stripModelHtml(html)
    expect(out).not.toMatch(/<[^>]+>/)
    expect(out).toContain('**Where Did Everyone Go**')
    // The paragraph boundary survives as a blank line, not a run-on.
    expect(out).toMatch(/portal\.\n\nThis endeavor/)
  })

  it('keeps link text and href', () => {
    expect(stripModelHtml('<p>See <a href="https://x.test">the site</a>.</p>')).toBe(
      'See [the site](https://x.test).',
    )
  })

  it('turns headings and list items into markdown', () => {
    const out = stripModelHtml('<h2>Heads up</h2><ul><li>one</li><li>two</li></ul>')
    expect(out).toContain('## Heads up')
    expect(out).toContain('- one')
    expect(out).toContain('- two')
  })

  it('decodes the entities models emit', () => {
    expect(stripModelHtml('<p>Tom &amp; Jerry &mdash; &quot;hi&quot;</p>')).toBe('Tom & Jerry — "hi"')
  })

  it('does not collapse a genuine less-than into a tag strip', () => {
    const text = 'if (a < b && b > c) return'
    expect(stripModelHtml(text)).toBe(text)
  })

  it('survives empty input', () => {
    expect(stripModelHtml('')).toBe('')
  })
})
