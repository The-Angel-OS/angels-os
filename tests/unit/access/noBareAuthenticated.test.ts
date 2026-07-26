/**
 * Class-level guard for footgun 2.2 (docs/FOOTGUNS.md): `authenticated` is
 * never an access check.
 *
 * `authenticated` is `Boolean(user)`. Customers and vendors share ONE dashboard
 * in this system, so a customer signing in to see their own appointment is
 * `authenticated` exactly like the electrician is. On 260725 that meant every
 * booking on the node — names, phones, addresses, prices — was readable, and
 * reschedulable, by anyone who had ever booked anything. Five collections were
 * affected; the sweep that found them was manual, which is why this test exists.
 *
 * `create: authenticated` is fine — anyone signed in may make a thing. Reads and
 * writes need ownership (`ownedBy`) or a role/tenant scope.
 *
 * This scans SOURCE rather than booting Payload: `pnpm test:unit` must not boot
 * Payload, and the string in the file is exactly what a future author will copy.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const COLLECTIONS_DIR = join(process.cwd(), 'src', 'collections')

/** `read: authenticated,` — but not `read: authenticatedOrPublished`. */
const BARE = /^\s*(read|update|delete)\s*:\s*authenticated\s*,?\s*(\/\/.*)?$/gm

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return tsFiles(full)
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : []
  })
}

describe('No bare `authenticated` on read/update/delete (260725 regression)', () => {
  it('finds no collection granting read/update/delete to any signed-in user', () => {
    const offenders: string[] = []

    for (const file of tsFiles(COLLECTIONS_DIR)) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(BARE)) {
        const line = source.slice(0, match.index).split('\n').length
        const rel = file.slice(process.cwd().length + 1).replace(/\\/g, '/')
        offenders.push(`${rel}:${line} → ${match[0].trim()}`)
      }
    }

    expect(
      offenders,
      `\nThese grant ${'read/update/delete'} to EVERY signed-in user, across every tenant.\n` +
        `Use ownedBy(...) from src/access/isDocumentOwner.ts, adminOnly, or a tenant scope.\n` +
        `(create: authenticated is fine and is deliberately not matched.)\n\n` +
        offenders.join('\n') +
        '\n',
    ).toEqual([])
  })

  it('the pattern actually matches what it claims to', () => {
    const sample = [
      '    read: authenticated,',
      '    update: authenticated,',
      '    delete: authenticated,',
      '    create: authenticated,', // allowed
      '    read: authenticatedOrPublished,', // different function
      "    read: ownedBy('client'),",
    ].join('\n')

    const hits = [...sample.matchAll(BARE)].map((m) => m[1])
    expect(hits).toEqual(['read', 'update', 'delete'])
  })
})
