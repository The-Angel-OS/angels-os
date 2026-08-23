import { describe, expect, it } from 'vitest'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

/**
 * A custom endpoint may not start with a collection slug.
 *
 * Payload owns `/api/<collection>/*` for its REST routes, and those win. A
 * handler registered at `/comments/add` is never reached — the request is read
 * as "the comment with id `add`" and comes back **Route not found**, with the
 * endpoint sitting right there in the config looking correct.
 *
 * This was a written-down rule with nothing enforcing it, so it shipped twice:
 * `/comments/add` (every comment on every portal failed, found 260822 when
 * someone actually tried to leave one) and `/media/analyze` (broken silently,
 * nobody noticed). The convention is a `-ops` suffix: `/comment-ops/add`.
 *
 * ponytail: regex over the config text, not a Payload boot. It reads the same
 * two lists the bug is about and costs nothing.
 */
const collectionSlugs = (): Set<string> => {
  const slugs = new Set<string>()
  const files = execSync('git ls-files src/collections').toString().trim().split(/\r?\n/)
  for (const f of files) {
    if (!f) continue
    const m = readFileSync(f, 'utf8').match(/slug:\s*'([a-z0-9-]+)'/)
    if (m) slugs.add(m[1]!)
  }
  return slugs
}

describe('custom endpoints never shadow a collection', () => {
  it('no endpoint path begins with a collection slug', () => {
    const cfg = readFileSync('src/payload.config.ts', 'utf8')
    const paths = [...new Set([...cfg.matchAll(/path:\s*'(\/[^']+)'/g)].map((m) => m[1]!))]
    const slugs = collectionSlugs()

    expect(slugs.size).toBeGreaterThan(10) // the scrape still works

    const colliding = paths.filter((p) => slugs.has(p.split('/')[1] ?? ''))
    expect(
      colliding,
      `Payload's REST routes shadow these — rename to "<thing>-ops/...": ${colliding.join(', ')}`,
    ).toEqual([])
  })
})
