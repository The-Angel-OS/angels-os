/**
 * Posts and Pages must gate on the SAME vocabulary. Both are handed to
 * `isPageViewable`, so if one collection grows a fifth level (or renames one)
 * the other silently mis-gates — a "members only" post rendering as public is a
 * paid-content leak, not a cosmetic bug.
 *
 * Read as SOURCE, not imported: importing a collection drags in payload.config.
 *
 * @see src/utilities/pageAccess.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PAGE_ACCESS_OPTIONS } from '@/utilities/pageAccess'

const ROOT = join(import.meta.dirname, '../../..')
const src = (p: string) => readFileSync(join(ROOT, p), 'utf-8')

/** The `access` select field's declared option values, in source order. */
function accessValues(source: string): string[] {
  const field = source.match(/name:\s*'access',[\s\S]{0,900}?\n\s{4}\},/)
  if (!field) return []
  // Either an inline options array or the shared PAGE_ACCESS_OPTIONS constant.
  if (/options:\s*PAGE_ACCESS_OPTIONS/.test(field[0])) {
    return PAGE_ACCESS_OPTIONS.map((o) => o.value)
  }
  return [...field[0].matchAll(/value:\s*'([a-z_]+)'/g)].map((m) => m[1]!)
}

describe('posts membership gating', () => {
  const posts = src('src/collections/Posts/index.ts')

  it('declares an access field defaulting to public', () => {
    expect(posts).toMatch(/name:\s*'access'/)
    expect(accessValues(posts)).toContain('good_standing')
    expect(posts.match(/name:\s*'access',[\s\S]{0,400}?defaultValue:\s*'public'/)).toBeTruthy()
  })

  it('offers exactly the same levels as Pages', () => {
    expect(accessValues(posts).sort()).toEqual(
      accessValues(src('src/collections/Pages/index.ts')).sort(),
    )
  })

  it('matches the resolver both collections are gated by', () => {
    expect(accessValues(posts).sort()).toEqual(PAGE_ACCESS_OPTIONS.map((o) => o.value).sort())
  })
})
