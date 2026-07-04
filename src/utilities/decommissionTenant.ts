/**
 * Hard-decommission a tenant and all latent artifacts on this node.
 *
 * Shared by the CLI script (scripts/decommission-tenant.ts) AND the LEO tool
 * (decommission_tenant) — build the factory once, mount it twice. Dry-run unless
 * `execute: true`; deletes child rows before parents (FK/lock-safe); scrubs users'
 * tenants[] membership (never deletes users); handles slug-referenced Works.
 */
import type { Payload, Where } from 'payload'

/** Ordered child → parent. Every tenant-scoped collection, leaves first. */
export const TENANT_SCOPED_COLLECTIONS = [
  'token-ledger', 'agent-transactions', 'justice-fund-transactions', 'wallets', 'cost-events',
  'reviews', 'orders', 'quest-participations', 'event-registrations', 'bookings', 'signatures', 'memberships',
  'products', 'services', 'quests', 'availability', 'events',
  'messages', 'channels', 'space-memberships', 'spaces',
  'comments', 'pages', 'posts', 'projects', 'categories', 'media-meta', 'media',
  'header', 'footer', 'site-settings', 'settings', 'permissions', 'street-signs',
  'connectors', 'vendors', 'workflows', 'holon-capabilities', 'crew-assignments',
  'logistics-nodes', 'transports', 'shipments', 'pheromones', 'work-units', 'board-members', 'endeavors',
] as const

export interface DecommissionStep {
  collection: string
  count: number
  status: 'counted' | 'deleted' | 'error' | 'scrubbed'
  error?: string
}

export interface DecommissionResult {
  found: boolean
  slug: string
  tenantId?: number | string
  name?: string
  domain?: string
  execute: boolean
  steps: DecommissionStep[]
  totalRows: number
}

export async function decommissionTenant(
  payload: Payload,
  opts: { slug: string; execute?: boolean },
): Promise<DecommissionResult> {
  const { slug } = opts
  const execute = opts.execute === true
  const steps: DecommissionStep[] = []
  let totalRows = 0

  const tenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
  })
  const tenant = tenants.docs[0] as any
  if (!tenant) return { found: false, slug, execute, steps, totalRows: 0 }
  const tenantId = tenant.id

  const run = async (collection: string, where: Where) => {
    try {
      const { totalDocs } = await payload.count({ collection: collection as any, where, overrideAccess: true })
      if (totalDocs === 0) return
      totalRows += totalDocs
      if (execute) {
        await payload.delete({ collection: collection as any, where, overrideAccess: true })
        steps.push({ collection, count: totalDocs, status: 'deleted' })
      } else {
        steps.push({ collection, count: totalDocs, status: 'counted' })
      }
    } catch (err) {
      steps.push({ collection, count: 0, status: 'error', error: (err as Error).message })
    }
  }

  // Vercel Blob purge — do this BEFORE deleting the `media` rows (which removes the
  // URLs we need). payload.delete runs the storage adapter's afterDelete hook, but on
  // a bulk where-delete that isn't guaranteed across versions, so we explicitly delete
  // every blob (main + every image size variant) to guarantee a demo portal's hosted
  // artifacts are DEFINITELY gone. Idempotent + fail-soft: no-ops on local/non-blob
  // URLs and never throws on an already-deleted blob.
  if (execute) {
    try {
      const { deleteMediaFromVercelBlob } = await import('./deleteMediaFromVercelBlob')
      let purged = 0
      const media = await payload.find({
        collection: 'media', where: { tenant: { equals: tenantId } }, limit: 10_000, depth: 0, overrideAccess: true,
      })
      for (const m of media.docs as any[]) {
        const sizeUrls = m.sizes ? Object.values(m.sizes).map((s: any) => s?.url) : []
        for (const u of [m.url, ...sizeUrls].filter(Boolean)) {
          try { await deleteMediaFromVercelBlob(u as string); purged++ } catch { /* best-effort per blob */ }
        }
      }
      if (purged) steps.push({ collection: 'media:blob', count: purged, status: 'deleted' })
    } catch (err) {
      steps.push({ collection: 'media:blob', count: 0, status: 'error', error: (err as Error).message })
    }
  }

  for (const collection of TENANT_SCOPED_COLLECTIONS) {
    await run(collection, { tenant: { equals: tenantId } })
  }

  // Works — referenced by tenant SLUG (federation-portable), not id.
  try {
    const works = await payload.find({ collection: 'works' as any, where: { owner: { equals: slug } }, limit: 200, overrideAccess: true })
    if (works.totalDocs > 0) {
      totalRows += works.totalDocs
      if (execute) {
        for (const w of works.docs) await payload.delete({ collection: 'works' as any, id: w.id, overrideAccess: true })
        steps.push({ collection: 'works', count: works.totalDocs, status: 'deleted' })
      } else {
        steps.push({ collection: 'works', count: works.totalDocs, status: 'counted' })
      }
    }
  } catch (err) {
    steps.push({ collection: 'works', count: 0, status: 'error', error: (err as Error).message })
  }

  // Users — scrub this tenant from each user's tenants[] array. Never delete users.
  try {
    const users = await payload.find({ collection: 'users', where: { 'tenants.tenant': { equals: tenantId } }, limit: 500, depth: 0, overrideAccess: true })
    if (users.totalDocs > 0) {
      if (execute) {
        for (const u of users.docs) {
          const kept = ((u as any).tenants || []).filter((t: any) => {
            const tid = typeof t.tenant === 'object' ? t.tenant?.id : t.tenant
            return String(tid) !== String(tenantId)
          })
          await payload.update({ collection: 'users', id: u.id, data: { tenants: kept } as any, overrideAccess: true })
        }
      }
      steps.push({ collection: 'users', count: users.totalDocs, status: execute ? 'scrubbed' : 'counted' })
    }
  } catch (err) {
    steps.push({ collection: 'users', count: 0, status: 'error', error: (err as Error).message })
  }

  await run('tenant-memberships', { tenant: { equals: tenantId } })

  // The tenant row itself — last. Killing its domain/domains[] stops routing.
  // On a drifted prod DB the tenants afterDelete hook can throw (e.g. a contacts
  // cleanup hitting a missing column), so fall back to a raw row delete that
  // bypasses hooks. Self-heals the exact failure seen decommissioning hays-cactus.
  if (!execute) {
    await run('tenants', { id: { equals: tenantId } })
  } else {
    totalRows += 1
    try {
      await payload.delete({ collection: 'tenants', where: { id: { equals: tenantId } }, overrideAccess: true })
      steps.push({ collection: 'tenants', count: 1, status: 'deleted' })
    } catch {
      try {
        const db: any = (payload as any).db // eslint-disable-line @typescript-eslint/no-explicit-any
        const pool = db.pool || db.drizzle?.session?.client
        await pool.query('DELETE FROM payload_locked_documents_rels WHERE tenants_id = $1', [tenantId]).catch(() => {})
        await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId])
        steps.push({ collection: 'tenants', count: 1, status: 'deleted' })
      } catch (err) {
        steps.push({ collection: 'tenants', count: 0, status: 'error', error: `hook+raw delete failed: ${(err as Error).message}` })
      }
    }
  }

  return { found: true, slug, tenantId, name: tenant.name, domain: tenant.domain, execute, steps, totalRows }
}
