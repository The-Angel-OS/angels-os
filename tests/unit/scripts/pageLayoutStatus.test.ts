import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * A page-layout update that omits `_status` silently UNPUBLISHES the page.
 *
 * Pages has drafts enabled, so `payload.update({ data: { layout } })` writes a
 * draft and the live URL starts returning 404 — with no error, and with the
 * script cheerfully logging "updated". It happened twice on 260727:
 * `/buy-kessela-now`, which is the only link on that site that takes money, and
 * then `/how-to-use-belt`. Both were found by accident, hours later.
 *
 * This asserts the PATTERN rather than any particular file, so it also catches
 * the script nobody has written yet. That is the difference between fixing the
 * instance and fixing the class.
 */
describe('page layout updates preserve _status', () => {
  const dir = join(process.cwd(), 'src', 'scripts', '_local')

  const offenders: string[] = []
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(join(dir, file), 'utf8')
    // `data: { layout }` / `data: { layout } as any` — a layout write with no
    // sibling keys, which is exactly the shape that drops _status.
    const bare = /data:\s*\{\s*layout\s*\}(\s+as\s+\w+)?\s*[,)]/g
    if (bare.test(src)) offenders.push(file)
  }

  it('no _local script writes `data: { layout }` without _status', () => {
    expect(
      offenders,
      `These scripts unpublish a live page when they run. Use updatePageLayout() ` +
        `from src/scripts/_local/_updatePageLayout.ts, or pass _status explicitly:\n  ` +
        offenders.join('\n  '),
    ).toEqual([])
  })
})
