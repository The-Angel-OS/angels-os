/**
 * Site Export Endpoint — Production
 *
 * Exports all tenant-scoped data into a JSON archive with SHA-256 checksums.
 * Covers all 35 tenant-scoped collections configured in multiTenantPlugin.
 *
 * GET /api/export-site
 * Headers: x-tenant-id (tenant slug, defaults to 'default')
 * Auth: super_admin | tenant_admin | admin
 *
 * Returns JSON: { success, manifest, data, message }
 *
 * The manifest includes:
 * - Per-collection document counts
 * - Per-collection SHA-256 checksums (deterministic, sorted keys)
 * - Overall integrity checksum
 * - Export metadata (version, timestamp, tenant info)
 *
 * @see src/endpoints/federation-suitcase.ts — Similar pattern for federation portability
 */

import type { PayloadHandler } from 'payload'
import crypto from 'crypto'

// ── Pure Helpers (exported for testing) ──────────────────────────────────────

/** Deterministic SHA-256 checksum with recursively sorted keys */
export function computeChecksum(data: unknown): string {
  const canonical = JSON.stringify(data, (_key, value) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(value).sort()) {
        sorted[k] = value[k]
      }
      return sorted
    }
    return value
  })
  return crypto.createHash('sha256').update(canonical).digest('hex')
}

/** All tenant-scoped collection slugs, grouped by domain */
export const EXPORT_COLLECTION_GROUPS: Record<string, string[]> = {
  content: ['pages', 'posts', 'projects', 'comments', 'categories', 'media', 'media-meta'],
  commerce: ['products', 'orders', 'reviews', 'bookings', 'availability'],
  community: ['spaces', 'space-memberships', 'channels', 'messages', 'contacts'],
  events: ['events', 'event-registrations'],
  organization: ['endeavors', 'workflows', 'connectors', 'board-members'],
  gamification: ['quests', 'quest-participations', 'street-signs'],
  justice: ['justice-fund-transactions', 'holon-capabilities'],
  logistics: ['logistics-nodes', 'transports', 'shipments', 'pheromones', 'work-units'],
  layout: ['header', 'footer'],
}

/** Returns flat list of all exportable collection slugs */
export function getAllExportCollections(): string[] {
  return Object.values(EXPORT_COLLECTION_GROUPS).flat()
}

/** Per-collection fetch limits (high-volume collections get higher limits) */
const COLLECTION_LIMITS: Record<string, number> = {
  messages: 50000,
  comments: 10000,
  header: 5,
  footer: 5,
}
const DEFAULT_LIMIT = 10000

/** Get the fetch limit for a collection */
export function getCollectionLimit(slug: string): number {
  return COLLECTION_LIMITS[slug] ?? DEFAULT_LIMIT
}

/** Collected export data for a single collection */
export interface CollectionExportResult {
  docs: unknown[]
  totalDocs: number
}

/** Build export manifest with per-collection checksums */
export function buildManifest(
  tenant: { id: string | number; name?: string; slug?: string },
  collectionData: Record<string, CollectionExportResult>,
  exportedBy: string,
) {
  const counts: Record<string, number> = {}
  const checksums: Record<string, string> = {}

  for (const [slug, result] of Object.entries(collectionData)) {
    counts[slug] = result.totalDocs
    checksums[slug] = computeChecksum(result.docs)
  }

  const totalDocuments = Object.values(counts).reduce((sum, c) => sum + c, 0)

  const manifest = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    exportedBy,
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    counts,
    checksums,
    totalDocuments,
    totalCollections: Object.keys(collectionData).length,
    checksum: '',
  }

  // Overall integrity checksum (excludes timestamp for reproducibility)
  manifest.checksum = computeChecksum({
    counts,
    checksums,
    tenant: manifest.tenant,
    version: manifest.version,
  })

  return manifest
}

// ── How many collections to fetch in parallel per wave ──────────────────────
const BATCH_SIZE = 12

// ── Handler ─────────────────────────────────────────────────────────────────

export const exportSite: PayloadHandler = async (req) => {
  const { payload, user } = req

  // ── Auth ─────────────────────────────────────────────────────────────────
  if (!user || !('roles' in user) || !Array.isArray(user.roles)) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const roles = (user.roles ?? []) as string[]
  const isAdmin = roles.some((r) => ['super_admin', 'tenant_admin', 'admin'].includes(r))
  if (!isAdmin) {
    return Response.json({ message: 'Forbidden: requires admin role' }, { status: 403 })
  }

  // ── Resolve Tenant ───────────────────────────────────────────────────────
  const tenantSlug = req.headers.get('x-tenant-id') || 'default'

  let tenantResult
  try {
    tenantResult = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[export-site] Tenant lookup error:', err)
    return Response.json(
      {
        message: 'Failed to resolve tenant',
        details: err instanceof Error ? err.message : 'Unknown',
      },
      { status: 500 },
    )
  }

  const tenant = tenantResult.docs?.[0]
  if (!tenant) {
    return Response.json({ message: 'Tenant not found' }, { status: 404 })
  }

  const tenantId = tenant.id

  try {
    // ── Fetch all collections in batched waves ───────────────────────────
    const allSlugs = getAllExportCollections()
    const collectionData: Record<string, CollectionExportResult> = {}

    for (let i = 0; i < allSlugs.length; i += BATCH_SIZE) {
      const batch = allSlugs.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map((slug) =>
          payload
            .find({
              collection: slug as any,
              where: { tenant: { equals: tenantId } },
              limit: getCollectionLimit(slug),
              depth: 0,
              overrideAccess: true,
            })
            .catch((err: Error) => {
              // Non-fatal: individual collection failures don't block the export
              console.warn(`[export-site] Failed to export ${slug}:`, err.message)
              return { docs: [] as unknown[], totalDocs: 0 }
            }),
        ),
      )

      for (let j = 0; j < batch.length; j++) {
        collectionData[batch[j]] = {
          docs: results[j].docs,
          totalDocs: results[j].totalDocs,
        }
      }
    }

    // ── Build manifest with checksums ────────────────────────────────────
    const exportedBy = (user as any).email || 'system'
    const manifest = buildManifest(tenant as any, collectionData, exportedBy)

    // ── Build data payload ──────────────────────────────────────────────
    const data: Record<string, unknown[]> = {}
    for (const [slug, result] of Object.entries(collectionData)) {
      data[slug] = result.docs
    }

    return Response.json({
      success: true,
      manifest,
      data,
      message: `Site export complete. ${manifest.totalDocuments} documents across ${manifest.totalCollections} collections.`,
    })
  } catch (err) {
    console.error('[export-site] Export error:', err)
    return Response.json(
      {
        message: 'Export failed',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
