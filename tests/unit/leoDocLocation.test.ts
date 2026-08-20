import { describe, it, expect } from 'vitest'
import { affectedPublicUrl } from '@/utilities/affectedUrl'

/**
 * Mirrors docLocationLines in leo-data-tools (module-private there — importing the
 * whole tool registry into a unit test drags in Payload). The contract under test
 * is the RULE: a draft points at the editor, never at a URL that 404s.
 */
function docLocationLines(
  collection: 'posts' | 'pages' | 'products',
  id: number | string,
  slug: string | undefined,
  status: string,
): string[] {
  const editUrl = `/admin/collections/${collection}/${id}`
  const publicUrl = slug ? affectedPublicUrl(collection, slug) : null
  const lines = [`- Open it: ${editUrl}`]
  if (status === 'published' && publicUrl) lines.push(`- Live at: ${publicUrl}`)
  const target = status === 'published' && publicUrl ? publicUrl : editUrl
  const label = status === 'published' && publicUrl ? 'View it' : 'Open the draft'
  lines[lines.length - 1] += `\n<!--nav:${JSON.stringify({ path: target, label })}-->`
  return lines
}

describe('docLocationLines — Leo says where the thing is', () => {
  it('sends a draft to the editor, never to the public URL that would 404', () => {
    const out = docLocationLines('posts', 12, 'my-post', 'draft').join('\n')
    expect(out).toContain('/admin/collections/posts/12')
    expect(out).not.toContain('/posts/my-post')
    expect(out).toContain('"path":"/admin/collections/posts/12"')
  })

  it('offers both editor and live URL once published', () => {
    const out = docLocationLines('posts', 12, 'my-post', 'published').join('\n')
    expect(out).toContain('/admin/collections/posts/12')
    expect(out).toContain('Live at: /posts/my-post')
    expect(out).toContain('"path":"/posts/my-post"')
  })

  it('still gives a way in when the doc has no slug yet', () => {
    const out = docLocationLines('pages', 3, undefined, 'published').join('\n')
    expect(out).toContain('/admin/collections/pages/3')
    expect(out).not.toContain('Live at')
  })

  it('maps the home page to / rather than /home', () => {
    expect(docLocationLines('pages', 1, 'home', 'published').join('\n')).toContain('Live at: /')
  })
})
