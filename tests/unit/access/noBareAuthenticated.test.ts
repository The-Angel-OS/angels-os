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

/**
 * Two spellings of the same defect:
 *   read: authenticated,                              ← the named helper
 *   read: ({ req: { user } }) => Boolean(user),       ← inline, identical meaning
 *
 * The first version of this test matched only the helper. On 260726 that hole
 * turned out to be 39 instances across 20 collections written the second way —
 * including tenant-memberships, where `create`/`update` open to any signed-in
 * user meant anyone could POST themselves a `tenant_admin` row on any tenant.
 * A guardrail that matches a spelling instead of a meaning is not a guardrail.
 */
const BARE_HELPER = /^\s*(read|update|delete)\s*:\s*authenticated\s*,?\s*(\/\/.*)?$/gm
const BARE_INLINE =
  /^\s*(read|update|delete)\s*:\s*\(\s*\{\s*req:\s*\{\s*user\s*\}\s*\}\s*\)\s*=>\s*Boolean\(\s*user\s*\)\s*,?\s*$/gm

/**
 * Collections still carrying the inline form, frozen as of 260726. Every one is
 * wrapped by the multi-tenant plugin, which ANDs a tenant filter onto access —
 * so a signed-in user sees only their own tenant's rows. That makes them
 * tenant-scoped debt rather than a cross-tenant leak, and worth revisiting, but
 * NOT the same class as the four that were unwrapped (tenant-memberships,
 * services, works, presence — all fixed).
 *
 * The point of the list is that it can only shrink: anything new fails.
 */
const KNOWN_TENANT_SCOPED_DEBT = new Set([
  'src/collections/BoardMembers.ts',
  // Presence is INTENTIONALLY global (who is online platform-wide), so a read
  // by any signed-in user is the design, not an oversight. Its update/delete
  // were scoped to the owner's own row on 260726.
  'src/collections/Presence/index.ts',
  'src/collections/Channels/index.ts',
  'src/collections/Contacts/index.ts',
  'src/collections/CostEvents/index.ts',
  'src/collections/CrewAssignments/index.ts',
  'src/collections/Endeavors/index.ts',
  'src/collections/HolonCapabilities/index.ts',
  'src/collections/Logistics/LogisticsNodes.ts',
  'src/collections/Logistics/Shipments.ts',
  'src/collections/Logistics/Transports.ts',
  'src/collections/MediaMeta/index.ts',
  'src/collections/Permissions/index.ts',
  'src/collections/Reviews/index.ts',
  'src/collections/Settings/index.ts',
  'src/collections/StreetSigns/index.ts',
  'src/collections/Vendors/index.ts',
])

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
      const rel = file.slice(process.cwd().length + 1).replace(/\\/g, '/')
      for (const match of source.matchAll(BARE_HELPER)) {
        const line = source.slice(0, match.index).split('\n').length
        offenders.push(`${rel}:${line} → ${match[0].trim()}`)
      }
      // Frozen debt is skipped; anything NEW in the inline spelling fails.
      if (KNOWN_TENANT_SCOPED_DEBT.has(rel)) continue
      for (const match of source.matchAll(BARE_INLINE)) {
        const line = source.slice(0, match.index).split('\n').length
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

    const hits = [...sample.matchAll(BARE_HELPER)].map((m) => m[1])
    expect(hits).toEqual(['read', 'update', 'delete'])
  })

  it('also matches the INLINE spelling, which is the same thing', () => {
    const sample = [
      '    read: ({ req: { user } }) => Boolean(user),',
      '    update: ({ req: { user } }) => Boolean(user),',
      '    delete: ({ req: { user } }) => Boolean(user),',
      '    create: ({ req: { user } }) => Boolean(user),', // allowed
      '    read: ({ req: { user } }) => (user ? { user: { equals: user.id } } : false),', // scoped
    ].join('\n')

    const hits = [...sample.matchAll(BARE_INLINE)].map((m) => m[1])
    expect(hits).toEqual(['read', 'update', 'delete'])
  })

  it('the debt list only shrinks — every entry still exists', () => {
    for (const rel of KNOWN_TENANT_SCOPED_DEBT) {
      const source = readFileSync(join(process.cwd(), rel), 'utf8')
      expect([...source.matchAll(BARE_INLINE)].length, `${rel} is clean — remove it from the list`).toBeGreaterThan(0)
    }
  })
})
