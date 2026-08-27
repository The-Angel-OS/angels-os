import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A collection carrying a `tenant` field is per-portal data. If the multi-tenant
 * plugin does not wrap it, its OWN access must do the scoping — nothing else
 * will.
 *
 * Services was the miss: not plugin-wrapped (its access comment says so), but
 * sharing an access function whose fast path returned unconstrained `true`
 * "because the plugin clamps". Any business owner could read every portal's
 * catalogue, prices and deposits included.
 *
 * This does not judge whether the scoping is CORRECT — it fails when a new
 * tenant-bearing collection appears with neither the plugin nor an entry here,
 * so the decision gets made deliberately instead of by omission.
 */
const COLLECTIONS_DIR = join(process.cwd(), 'src', 'collections')
const CONFIG = readFileSync(join(process.cwd(), 'src', 'payload.config.ts'), 'utf8')

/**
 * Tenant-bearing collections the plugin does NOT wrap, each with the reason its
 * own access is sufficient. Adding a line here is a deliberate act.
 */
const SELF_SCOPED: Record<string, string> = {
  services: 'connectorScopedAccess — platform admins only, else a tenant Where',
  memberships: 'owner-scoped: a member reads their own rows, which is tighter than tenant',
  signatures: 'owner-scoped: a signer reads their own signatures',
  wallets: 'owner-scoped: a user reads their own wallet rows',
  'token-ledger': 'owner-scoped: a user reads their own ledger rows',
  'agent-transactions': 'platform admins only',
  'tenant-memberships': 'membershipReadAccess — own rows plus rosters of your tenants',
  'system-events':
    'super_admin only, and never tenant-scoped by design: most webhooks arrive ' +
    'BEFORE a tenant is resolved, so a tenant filter would hide exactly the ' +
    'arrivals worth reading — the ones that failed before they knew who they were for',
}

function pluginCollections(): Set<string> {
  const start = CONFIG.indexOf('multiTenantPlugin<Config>')
  const end = CONFIG.indexOf('userHasAccessToAllTenants')
  const block = CONFIG.slice(start, end)
  return new Set([...block.matchAll(/^\s+'?([a-z][a-z0-9-]*)'?:\s*\{/gm)].map((m) => m[1]))
}

function tenantBearingCollections(): { slug: string; file: string }[] {
  const out: { slug: string; file: string }[] = []
  for (const entry of readdirSync(COLLECTIONS_DIR, { recursive: true })) {
    const f = String(entry)
    if (!f.endsWith('.ts')) continue
    const src = readFileSync(join(COLLECTIONS_DIR, f), 'utf8')
    if (!src.includes('CollectionConfig')) continue
    const slug = src.match(/^\s*slug:\s*'([a-z][a-z0-9-]*)'/m)?.[1]
    if (!slug) continue
    if (!/name:\s*'tenant'/.test(src)) continue
    out.push({ slug, file: f })
  }
  return out
}

describe('tenant scope coverage', () => {
  it('every tenant-bearing collection is plugin-wrapped or explicitly self-scoped', () => {
    const wrapped = pluginCollections()
    const unaccounted = tenantBearingCollections()
      .filter((c) => !wrapped.has(c.slug) && !(c.slug in SELF_SCOPED))
      .map((c) => `${c.slug} (${c.file})`)

    expect(
      unaccounted,
      'These collections carry a `tenant` field but are neither registered with ' +
        'multiTenantPlugin nor listed in SELF_SCOPED. Register them, or add a line ' +
        'to SELF_SCOPED stating why their own access is sufficient. Access that is ' +
        'only safe because something else clamps it is not access control.',
    ).toEqual([])
  })

  it('the shared portal-manager access never returns an unscoped true to non-admins', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'access', 'connectorAccess.ts'), 'utf8')
    // The exact regression: a fast path that trusted the plugin to clamp.
    expect(src).not.toMatch(/isOwnerOrStaff\(user\)\)\s*return true/)
    expect(src).toContain('isPlatformAdmin')
  })
})
