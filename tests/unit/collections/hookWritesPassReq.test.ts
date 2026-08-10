import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A collection hook that writes without `req` does not join the parent
 * transaction. The result is either a silently dropped FK or a distributed
 * deadlock that hangs for EXACTLY 300s. It has bitten this codebase more than
 * once, so it is a lint, not a memo.
 *
 * @see project_provisioning_transaction_fragility
 */

const ROOT = join(import.meta.dirname, '../../..')

// Hooks only. Endpoints and scripts have no parent transaction to join.
const HOOK_FILES = globSync(
  ['src/collections/**/hooks/**/*.ts', 'src/collections/**/hooks.ts', 'src/hooks/**/*.ts', 'src/collections/*.ts'],
  { cwd: ROOT },
)

/** Slice from `payload.create(` to its matching `)`. */
function callSlice(src: string, openParen: number): string {
  let depth = 0
  for (let i = openParen; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')' && --depth === 0) return src.slice(openParen, i)
  }
  return src.slice(openParen)
}

describe('collection hooks pass req to nested writes', () => {
  it('finds hook files to check', () => {
    expect(HOOK_FILES.length).toBeGreaterThan(10)
  })

  // The detector itself, so a green suite means "clean", not "regex broken".
  it('detects a bare write and accepts one with req', () => {
    const bare = `await payload.create({ collection: 'x', data: { req: 1 }, overrideAccess: true })`
    const good = `await req.payload.create({ collection: 'x', data: {},\n      req,\n    })`
    const check = (s: string) =>
      [...s.matchAll(/payload\s*\.\s*(create|update|delete)\s*\(/g)].filter(
        (m) => !/^\s*req\s*[,:]/m.test(callSlice(s, m.index + m[0].length - 1)),
      ).length
    expect(check(bare)).toBe(1)
    expect(check(good)).toBe(0)
  })

  it.each(HOOK_FILES)('%s', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf-8')
    const offenders: string[] = []

    for (const m of src.matchAll(/payload\s*\.\s*(create|update|delete)\s*\(/g)) {
      const slice = callSlice(src, m.index + m[0].length - 1)
      // `req,` or `req: x` as an option key — not `req.payload` or `req.user`.
      if (!/^\s*req\s*[,:]/m.test(slice)) {
        offenders.push(`line ${src.slice(0, m.index).split('\n').length}: payload.${m[1]}()`)
      }
    }

    expect(offenders, `${rel} writes without req — pass \`req\` so it joins the transaction`).toEqual(
      [],
    )
  })
})
