import { describe, expect, it } from 'vitest'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

/**
 * `user.tenants` is MEMBERSHIP with no role - it must never authorize anything.
 *
 * `users_tenants` is (_order, _parent_id, id, tenant_id). There is no role
 * column. And enrol-on-arrival (the app layout) makes every signed-in visitor an
 * active tenant_member of any portal whose page they load, which lands in that
 * array. So "is this tenant in user.tenants" answers "have they ever looked at
 * this site", not "do they run it".
 *
 * Keyed off it, on 260822: any signed-in visitor could delete another portal's
 * products, and list/accept/fulfil/ship its orders - customer names and
 * addresses included. Use managedTenantIds(req), which resolves the role from
 * tenant-memberships.
 *
 * ponytail: a grep with an allowlist, not a taint analysis. The allowlist is the
 * documentation - each entry says why belonging really is the question.
 */

/** Places where "does this user BELONG to the tenant" is genuinely the question. */
const ALLOWED = new Set([
  // Server-side provisioning/teardown, run as an admin flow, not a user check.
  'src/app/[locale]/(dashboard)/dashboard/admin/provision/actions.ts',
  'src/endpoints/provision-wdeg-portal.ts',
  'src/utilities/provisionPortal.ts',
  'src/utilities/decommissionTenant.ts',
  // The hook that WRITES the array.
  'src/collections/TenantMemberships/hooks/syncUserTenants.ts',
  // Member-facing entitlements: belonging is exactly the question.
  'src/utilities/portalEntitlements.ts',
  // Accepts a client error report scoped to a tenant - writes a log line, grants
  // nothing and exposes nothing.
  'src/endpoints/client-error.ts',

  // ---- NOT YET REVIEWED (260822) -------------------------------------------
  // These pick WHICH tenant to act in (a default when no x-tenant-id was sent)
  // rather than deciding whether you may. A different class from the leaks
  // above, and plausibly fine - but "plausibly fine" is what the products and
  // orders holes looked like too. Listed so they are tracked, not blessed.
  'src/endpoints/ai-bus-poll.ts',
  'src/endpoints/ai-bus-stream.ts',
  'src/endpoints/x-post.ts',
])

const NL = String.fromCharCode(10)
const BACKSLASH = String.fromCharCode(92)

/** Comments are stripped: the prose explaining this rule names user.tenants. */
const stripComments = (raw: string): string =>
  raw
    .split(NL)
    .filter((l) => {
      const t = l.trim()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join(NL)

describe('user.tenants never authorizes', () => {
  it('no unreviewed file reads user.tenants for an access decision', () => {
    const files = execSync('git ls-files src')
      .toString()
      .split(NL)
      .map((l) => l.trim())
      .filter(Boolean)
    const offenders: string[] = []

    for (const f of files) {
      if (!/[.](ts|tsx)$/.test(f)) continue
      if (f.endsWith('payload-types.ts')) continue
      if (ALLOWED.has(f.split(BACKSLASH).join('/'))) continue

      const src = stripComments(readFileSync(f, 'utf8'))
      // "user" then ".tenants" close together - the shape of an access decision.
      if (/user[^;]{0,40}[.]tenants\b/.test(src)) offenders.push(f)
    }

    expect(
      offenders,
      'user.tenants carries no role - use managedTenantIds(req), or add to ALLOWED with a reason: ' +
        offenders.join(', '),
    ).toEqual([])
  })
})
