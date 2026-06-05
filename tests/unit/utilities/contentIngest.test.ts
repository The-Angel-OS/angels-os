/**
 * contentIngest + worksFromContent — URL/text → Work draft pipeline.
 * No network, no model: fetch and structurer are injected.
 */
import { describe, it, expect } from 'vitest'
import {
  isUnsafeHost,
  normalizeSourceUrl,
  extractReadableFromHtml,
  fetchReadableContent,
} from '@/utilities/contentIngest'
import { buildWorkDraftFromText } from '@/utilities/worksFromContent'

const html = `<!doctype html><html><head><title>Site</title></head><body>
  <nav>menu junk</nav>
  <article>
    <h1>The Real Headline</h1>
    <p>First paragraph of the body.</p>
    <h2>A Section</h2>
    <p>Second paragraph here.</p>
    <ul><li>point one</li><li>point two</li></ul>
  </article>
  <footer>footer junk</footer>
</body></html>`

function fakeFetch(body: string, contentType = 'text/html'): typeof fetch {
  return (async () =>
    new Response(body, { status: 200, headers: { 'content-type': contentType } })) as unknown as typeof fetch
}

describe('contentIngest — SSRF guard', () => {
  it('blocks loopback / private / link-local hosts', () => {
    for (const h of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.0.1', '169.254.169.254', '172.16.5.5', '::1']) {
      expect(isUnsafeHost(h)).toBe(true)
    }
  })
  it('allows public hosts', () => {
    for (const h of ['example.com', 'docs.google.com', '8.8.8.8', 'sub.domain.org']) {
      expect(isUnsafeHost(h)).toBe(false)
    }
  })
  it('rejects unsafe + non-http URLs in fetchReadableContent', async () => {
    await expect(fetchReadableContent('ftp://example.com/x')).rejects.toThrow(/http/i)
    await expect(fetchReadableContent('http://localhost/secret')).rejects.toThrow(/not allowed/i)
  })
})

describe('contentIngest — Google Docs normalization', () => {
  it('rewrites a Google Doc URL to the txt export', () => {
    expect(normalizeSourceUrl('https://docs.google.com/document/d/ABC123_x/edit')).toBe(
      'https://docs.google.com/document/d/ABC123_x/export?format=txt',
    )
  })
  it('leaves non-Google and already-export URLs alone', () => {
    expect(normalizeSourceUrl('https://example.com/post')).toBe('https://example.com/post')
    expect(normalizeSourceUrl('https://docs.google.com/document/d/X/export?format=txt')).toContain('export')
  })
})

describe('contentIngest — HTML extraction', () => {
  it('extracts title + structured text, dropping nav/footer', () => {
    const c = extractReadableFromHtml(html, 'https://example.com/a')
    expect(c.title).toBe('The Real Headline')
    expect(c.text).toContain('First paragraph of the body.')
    expect(c.text).toContain('## A Section')
    expect(c.text).toContain('- point one')
    expect(c.text).not.toContain('menu junk')
    expect(c.text).not.toContain('footer junk')
  })

  it('fetches + extracts via injected fetch', async () => {
    const c = await fetchReadableContent('https://example.com/a', { fetchImpl: fakeFetch(html) })
    expect(c.title).toBe('The Real Headline')
    expect(c.sourceUrl).toBe('https://example.com/a')
  })

  it('uses plaintext bodies as-is', async () => {
    const c = await fetchReadableContent('https://example.com/doc.txt', {
      fetchImpl: fakeFetch('Just some plain text content that is long enough.', 'text/plain'),
    })
    expect(c.text).toContain('plain text content')
  })

  it('throws when no readable text is found', async () => {
    await expect(
      fetchReadableContent('https://example.com/empty', { fetchImpl: fakeFetch('<html><body></body></html>') }),
    ).rejects.toThrow(/no readable text/i)
  })
})

describe('worksFromContent — buildWorkDraftFromText', () => {
  const fakeStructure = async (text: string) => ({
    title: 'Structured Title',
    subtitle: 'A subtitle',
    pages: [
      { title: 'Intro', markdown: '# Intro\n\n' + text.slice(0, 20) },
      { title: 'Body', markdown: 'More content.' },
    ],
  })

  it('builds a draft from the structurer output', async () => {
    const draft = await buildWorkDraftFromText('Some long article text here.', { structureFn: fakeStructure })
    expect(draft.title).toBe('Structured Title')
    expect(draft.media).toBe('doc')
    expect(draft.defaultLanguage).toBe('en')
    expect(draft.pages).toHaveLength(2)
    expect(draft.pages[0].order).toBe(0)
    expect(draft.pages[1].order).toBe(1)
    expect(draft.pages.every((p) => typeof p.id === 'string')).toBe(true)
  })

  it('honors an explicit title override', async () => {
    const draft = await buildWorkDraftFromText('text', { title: 'My Title', structureFn: fakeStructure })
    expect(draft.title).toBe('My Title')
  })

  it('falls back to a heading-split when the structurer throws', async () => {
    const failing = async () => {
      throw new Error('model down')
    }
    const draft = await buildWorkDraftFromText('# Chapter One\n\nAlpha.\n\n## Chapter Two\n\nBeta.', {
      structureFn: failing,
    })
    expect(draft.pages.length).toBeGreaterThanOrEqual(2)
    expect(draft.pages[0].markdown).toContain('Alpha')
    expect(draft.title.toLowerCase()).toContain('chapter one')
  })

  it('fallback produces a single page for unstructured text', async () => {
    const failing = async () => {
      throw new Error('no model')
    }
    const draft = await buildWorkDraftFromText('Just one blob of prose with no headings at all.', {
      structureFn: failing,
    })
    expect(draft.pages).toHaveLength(1)
    expect(draft.pages[0].markdown).toContain('blob of prose')
  })
})
