import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * An update to a drafts-enabled collection that omits `_status` silently
 * UNPUBLISHES the document.
 *
 * Pages, Posts and Products all have drafts. So `payload.update({ data: {...} })`
 * with no `_status` writes a DRAFT: the live URL starts returning 404, nothing
 * errors, and the script cheerfully logs "updated". It happened on 260727 to
 * `/buy-kessela-now` (the only link on that site that takes money) and
 * `/how-to-use-belt`, and again on 260728 to the Kessela product page itself.
 *
 * The 260727 version of this test caught only `data: { layout }` and looked only
 * in `src/scripts/_local`. The 260728 repeat was `data: { gallery, layout }` in
 * `scripts/_local` — a different shape in a directory the guard did not know
 * existed. A guard that only recognises the exact incident it was written for is
 * a guard for one incident. This one asserts the RULE: any update to a versioned
 * collection carries `_status`.
 */
describe('updates to versioned collections preserve _status', () => {
  /** Collections with `versions: { drafts: true }` — an update here can unpublish. */
  const VERSIONED = ['pages', 'posts', 'products']

  const dirs = [
    join(process.cwd(), 'src', 'scripts', '_local'),
    join(process.cwd(), 'scripts', '_local'),
  ].filter(existsSync)

  const offenders: string[] = []

  for (const dir of dirs) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const src = readFileSync(join(dir, file), 'utf8')

      // Each `payload.update(` and the window of source that follows it — long
      // enough to hold the options object, short enough not to bleed into the
      // next statement.
      let from = 0
      for (;;) {
        const at = src.indexOf('payload.update(', from)
        if (at === -1) break
        from = at + 1

        const call = src.slice(at, at + 900)
        const collection = call.match(/collection:\s*'([a-z-]+)'/)?.[1]
        if (!collection || !VERSIONED.includes(collection)) continue
        if (!/\bdata:\s*\{/.test(call)) continue
        if (/_status/.test(call)) continue

        offenders.push(`${file} → ${collection}`)
      }
    }
  }

  it('no _local script updates pages/posts/products without _status', () => {
    expect(
      offenders,
      `These scripts unpublish a live document when they run. Pass the doc's own ` +
        `_status through (and draft: false to publish), or use updatePageLayout() ` +
        `from src/scripts/_local/_updatePageLayout.ts:\n  ` +
        offenders.join('\n  '),
    ).toEqual([])
  })

  it('is actually looking at scripts — a guard that scans nothing passes forever', () => {
    const counted = dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.ts')))
    expect(dirs.length).toBeGreaterThan(0)
    expect(counted.length).toBeGreaterThan(10)
  })
})
