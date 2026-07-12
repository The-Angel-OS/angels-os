/**
 * Teleport — cross-instance tenant move (the consolidation primitive).
 *
 * Pulls one tenant's entire content graph from a SOURCE Angel OS node
 * (e.g. kendev.co) and re-plants it on THIS node (e.g. spacesangels.com),
 * so a portal built on a peer node can be consolidated onto the canonical node
 * with no cross-server auth/CORS at benefactor-connect time.
 *
 * Why this is cheap: both nodes share the SAME Vercel Blob account/token, and
 * media `url`s are instance-relative (`/api/media/file/<filename>`). The blob is
 * keyed by filename, so the SOURCE's binaries are ALREADY reachable from this
 * node. Teleport copies media ROWS verbatim — zero bytes transferred — and the
 * relative URLs resolve here unchanged. (Verified: this node already serves the
 * source's files byte-identically.)
 *
 * Transport: the SOURCE side is the existing GET /api/export-site (all 35
 * tenant-scoped collections + checksums), now callable node-to-node via
 * ?key=CRON_SECRET. This endpoint (the TARGET side) fetches that export.
 *
 * Safety: DRY RUN by default (`execute !== true`). The dry run WRITES NOTHING —
 * it returns the manifest of what would move plus readiness checks (target slug
 * availability, per-media resolvability on this node). The execute/write path
 * (id-remap graph walk) lands in a follow-up once the dry run is reviewed.
 *
 * Auth: super_admin session OR ?key=CRON_SECRET (factory / scriptable).
 */

import type { PayloadHandler } from 'payload'

interface TeleportBody {
  /** Base URL of the source node, e.g. "https://kendev.co" or "https://arctic-cool.kendev.co". */
  sourceBaseUrl?: string
  /** Tenant slug to move (e.g. "arctic-cool"). */
  sourceSlug?: string
  /** Target slug on THIS node. Defaults to sourceSlug (retain slug). */
  targetSlug?: string
  /** Target primary domain. Defaults to "<targetSlug>.spacesangels.com". */
  targetDomain?: string
  /** Source node's CRON_SECRET, if it differs from this node's. Defaults to our own. */
  sourceKey?: string
  /** false / omitted → DRY RUN (report only). */
  execute?: boolean
}

const DEFAULT_TARGET_APEX = 'spacesangels.com'

export const teleportImportHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  // ── Auth: super_admin session OR ?key=CRON_SECRET ──────────────────────────
  const url = new URL(req.url || 'http://localhost', 'http://localhost')
  const key = url.searchParams.get('key')
  const isSuperAdmin = Boolean(
    ((user as { roles?: string[] } | undefined)?.roles)?.includes('super_admin'),
  )
  const keyValid = Boolean(key && process.env.CRON_SECRET && key === process.env.CRON_SECRET)
  if (!isSuperAdmin && !keyValid) {
    return Response.json({ error: 'super_admin or ?key=CRON_SECRET required' }, { status: 403 })
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: TeleportBody = {}
  try {
    body = (await (req as unknown as Request).json()) as TeleportBody
  } catch {
    body = {}
  }

  const sourceBaseUrl = String(body.sourceBaseUrl || '').replace(/\/+$/, '')
  const sourceSlug = String(body.sourceSlug || '').trim()
  const targetSlug = String(body.targetSlug || sourceSlug || '').trim()
  const targetDomain =
    String(body.targetDomain || '').trim() || `${targetSlug}.${DEFAULT_TARGET_APEX}`
  const sourceKey = body.sourceKey || process.env.CRON_SECRET || ''
  const execute = body.execute === true

  if (!sourceBaseUrl || !sourceSlug) {
    return Response.json(
      { error: 'sourceBaseUrl and sourceSlug are required' },
      { status: 400 },
    )
  }
  if (!/^https?:\/\//i.test(sourceBaseUrl)) {
    return Response.json({ error: 'sourceBaseUrl must be an absolute http(s) URL' }, { status: 400 })
  }

  // ── Pull the source tenant's graph via the source's export-site endpoint ────
  const exportUrl = `${sourceBaseUrl}/api/export-site?key=${encodeURIComponent(sourceKey)}`
  let exportJson: {
    success?: boolean
    manifest?: { tenant?: Record<string, unknown>; totalDocuments?: number; collections?: Record<string, { count?: number }> }
    data?: Record<string, unknown[]>
    message?: string
  }
  try {
    const res = await fetch(exportUrl, {
      method: 'GET',
      headers: { 'x-tenant-id': sourceSlug, 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return Response.json(
        {
          error: `Source export failed (${res.status})`,
          detail: text.slice(0, 500),
          hint:
            res.status === 401
              ? 'Source rejected the key — its CRON_SECRET may differ. Pass sourceKey in the body.'
              : undefined,
        },
        { status: 502 },
      )
    }
    exportJson = await res.json()
  } catch (e) {
    return Response.json(
      { error: 'Could not reach source', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }

  const data = exportJson.data || {}
  const srcTenant = exportJson.manifest?.tenant || {}

  // ── Per-collection census (non-empty only, for a readable manifest) ─────────
  const census: Record<string, number> = {}
  let totalDocs = 0
  for (const [slug, docs] of Object.entries(data)) {
    const n = Array.isArray(docs) ? docs.length : 0
    if (n > 0) census[slug] = n
    totalDocs += n
  }

  // ── Media: list filenames and check each ALREADY resolves on THIS node ──────
  // (Confirms the shared-blob assumption per-file before we rely on verbatim rows.)
  const mediaDocs = (data.media as Array<Record<string, unknown>>) || []
  const thisOrigin = new URL(req.url || `https://${targetDomain}`, `https://${targetDomain}`).origin
  const mediaChecks: Array<{ filename: string; resolvesHere: boolean; status: number }> = []
  await Promise.all(
    mediaDocs.slice(0, 100).map(async (m) => {
      const filename = String(m.filename || '')
      if (!filename) return
      try {
        const r = await fetch(`${thisOrigin}/api/media/file/${encodeURIComponent(filename)}`, {
          method: 'HEAD',
        })
        mediaChecks.push({ filename, resolvesHere: r.ok, status: r.status })
      } catch {
        mediaChecks.push({ filename, resolvesHere: false, status: 0 })
      }
    }),
  )
  const mediaResolvable = mediaChecks.filter((c) => c.resolvesHere).length
  const mediaMissing = mediaChecks.filter((c) => !c.resolvesHere)

  // ── Target readiness: does a tenant with targetSlug/targetDomain already exist? ──
  let targetSlugTaken = false
  let targetDomainTaken = false
  try {
    const existing = await payload.find({
      collection: 'tenants',
      where: { or: [{ slug: { equals: targetSlug } }, { domain: { equals: targetDomain } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const hit = existing.docs?.[0] as { slug?: string; domain?: string } | undefined
    if (hit) {
      targetSlugTaken = hit.slug === targetSlug
      targetDomainTaken = hit.domain === targetDomain
    }
  } catch {
    /* non-fatal for the dry run */
  }

  const report = {
    mode: execute ? 'execute' : 'dry-run',
    source: { baseUrl: sourceBaseUrl, slug: sourceSlug, tenantName: srcTenant.name ?? srcTenant.slug },
    target: {
      slug: targetSlug,
      domain: targetDomain,
      slugAlreadyExists: targetSlugTaken,
      domainAlreadyExists: targetDomainTaken,
    },
    census,
    totalDocuments: totalDocs,
    media: {
      total: mediaDocs.length,
      checked: mediaChecks.length,
      alreadyResolveOnThisNode: mediaResolvable,
      missingFromSharedBlob: mediaMissing, // should be [] if the blob is truly shared
    },
    readiness: {
      blobShared: mediaMissing.length === 0,
      safeToExecute: !targetSlugTaken && !targetDomainTaken && mediaMissing.length === 0,
    },
    warnings: [
      ...(targetSlugTaken ? [`Target slug "${targetSlug}" already exists on this node.`] : []),
      ...(targetDomainTaken ? [`Target domain "${targetDomain}" already exists on this node.`] : []),
      ...(mediaMissing.length
        ? [`${mediaMissing.length} media file(s) do NOT resolve on this node — blob not fully shared; verbatim media rows would 404.`]
        : []),
    ],
  }

  if (!execute) {
    return Response.json({ success: true, ...report })
  }

  // ── Execute path (id-remap graph walk) — lands after dry-run review. ─────────
  return Response.json(
    {
      success: false,
      ...report,
      error:
        'Execute path not enabled in this build. Review the dry-run manifest first; the write path ships next.',
    },
    { status: 501 },
  )
}
