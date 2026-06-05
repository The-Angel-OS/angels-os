/**
 * Works Seal Endpoints — Works Engine slice #2.
 *
 *   POST /api/works-ops/seal       { channelId }        → seal a Work draft (auth)
 *   GET  /api/works-ops/manifest?slug=<slug>            → serve a sealed manifest (public)
 *
 * Sealing reads the mutable Work draft (a Channel's `data.workDraft`), content-
 * addresses any page images into CAS (Vercel Blob in prod), builds a signed,
 * multilingual release manifest with the tenant's federation key, self-verifies,
 * and stores the result back on the channel (`data.sealedManifest`). The draft is
 * left intact — the workshop stays mutable; sealing publishes a snapshot.
 *
 * The `-ops` path prefix avoids Payload's collection-route shadowing (there is no
 * `works` collection; this keeps us clear of the rule regardless). See
 * docs/WORKS_ENGINE.md and the seal-script ancestor scripts/_local/library_seal.mjs.
 */
import type { Payload, PayloadHandler } from 'payload'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { getOrCreateFederationKeyPair } from '@/federation/keyStore'
import { casPutBuffer } from '@/utilities/worksCas'
import { sealWork, type WorkDraft, type CasAsset, type SealedManifest } from '@/utilities/worksSeal'

// ── Authorization: super_admin, or tenant_admin / manage_content on the tenant ──
export async function authorizeForTenant(
  payload: Payload,
  user: { id: number | string } | null | undefined,
  tenantId: number | string,
): Promise<boolean> {
  if (!user) return false
  if (checkRole(ADMIN_ROLES, user as never)) return true
  const m = await payload.find({
    collection: 'tenant-memberships' as never,
    where: {
      and: [
        { user: { equals: user.id } },
        { tenant: { equals: tenantId } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = m.docs?.[0] as { role?: string; permissions?: string[] } | undefined
  return doc?.role === 'tenant_admin' || (Array.isArray(doc?.permissions) && doc.permissions.includes('manage_content'))
}

/** Best-effort resolve a page image (Media id) into a content-addressed CAS asset. */
async function resolveImageAsset(
  payload: Payload,
  mediaId: string | number,
): Promise<CasAsset | null> {
  try {
    const media = (await payload.findByID({
      collection: 'media',
      id: mediaId,
      depth: 0,
      overrideAccess: true,
    })) as { url?: string; mimeType?: string; filename?: string } | null
    const url = media?.url
    if (!url || !/^https?:\/\//i.test(url)) return null // only absolute (blob) URLs are fetchable here
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const ext = (media?.filename?.split('.').pop() || media?.mimeType?.split('/').pop() || 'bin').toLowerCase()
    return await casPutBuffer(buf, ext)
  } catch {
    return null
  }
}

export const worksSealHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const denied = applyRateLimit(req, 'default')
  if (denied) return denied

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const channelId = body.channelId
  if (!channelId || (typeof channelId !== 'string' && typeof channelId !== 'number')) {
    return Response.json({ error: 'channelId is required' }, { status: 400 })
  }

  // ── Load the channel + its Work draft ──────────────────────────────────────
  const channel = (await payload.findByID({
    collection: 'channels',
    id: channelId,
    depth: 0,
    overrideAccess: true,
  })) as { id: string | number; slug?: string; tenant?: string | number; data?: Record<string, unknown> } | null

  if (!channel) return Response.json({ error: 'Work not found' }, { status: 404 })

  const tenantId = channel.tenant
  if (!tenantId) return Response.json({ error: 'Work has no tenant' }, { status: 400 })

  if (!(await authorizeForTenant(payload, user, tenantId))) {
    return Response.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const data = (channel.data && typeof channel.data === 'object' ? channel.data : {}) as Record<string, unknown>
  const draft = data.workDraft as WorkDraft | undefined
  if (!draft || !Array.isArray(draft.pages)) {
    return Response.json({ error: 'This work has no draft to seal' }, { status: 400 })
  }
  if (draft.pages.length === 0) {
    return Response.json({ error: 'Add at least one page before sealing' }, { status: 400 })
  }

  const slug = channel.slug || `work-${channel.id}`

  // ── Content-address any page images (primer works) ─────────────────────────
  const casAssets: Record<string, CasAsset> = {}
  for (const p of draft.pages) {
    if (p.imageMediaId != null) {
      const asset = await resolveImageAsset(payload, p.imageMediaId)
      if (asset) casAssets[String(p.order)] = asset
    }
  }

  // ── Sign with the tenant's federation key ──────────────────────────────────
  let keyPair: { publicKey: string; privateKey: string }
  try {
    keyPair = await getOrCreateFederationKeyPair(payload, Number(tenantId))
  } catch (e) {
    payload.logger.error(`[works-seal] key error for tenant ${tenantId}: ${e instanceof Error ? e.message : e}`)
    return Response.json({ error: 'Could not access signing key' }, { status: 500 })
  }

  const previousVersion = typeof data.sealedVersion === 'number' ? data.sealedVersion : 0
  const { manifest, verified } = sealWork({
    draft,
    slug,
    signerPublicKey: keyPair.publicKey,
    signerPrivateKey: keyPair.privateKey,
    previousVersion,
    casAssets,
  })

  if (!verified) {
    payload.logger.error(`[works-seal] self-verification FAILED for ${slug}`)
    return Response.json({ error: 'Seal failed self-verification' }, { status: 500 })
  }

  // ── Persist the sealed manifest back on the channel (draft untouched) ──────
  try {
    await payload.update({
      collection: 'channels',
      id: channel.id,
      data: {
        data: {
          ...data,
          sealedManifest: manifest,
          sealedSlug: slug,
          sealedVersion: manifest.version,
          sealedAt: new Date().toISOString(),
        },
      } as never,
      overrideAccess: true,
    })
  } catch (e) {
    payload.logger.error(`[works-seal] persist error for ${slug}: ${e instanceof Error ? e.message : e}`)
    return Response.json({ error: 'Sealed, but failed to save' }, { status: 500 })
  }

  payload.logger.info(
    `[works-seal] sealed '${manifest.title}' slug=${slug} v${manifest.version} ` +
      `langs=${manifest.languages.length} manifestCid=${manifest.manifestCid.slice(0, 16)}…`,
  )

  return Response.json({
    success: true,
    slug,
    version: manifest.version,
    manifestCid: manifest.manifestCid,
    baseContentCid: manifest.baseContentCid,
    signerPublicKey: manifest.signerPublicKey,
    languages: manifest.languages.map((l) => l.code),
    pageCount: manifest.pageCount,
    manifestUrl: `/api/works-ops/manifest?slug=${encodeURIComponent(slug)}`,
    verified,
  })
}

export const worksManifestHandler: PayloadHandler = async (req) => {
  const { payload } = req
  const url = new URL(req.url || '', 'http://localhost')
  const slug = url.searchParams.get('slug')
  if (!slug) return Response.json({ error: 'slug is required' }, { status: 400 })

  const found = await payload.find({
    collection: 'channels',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const channel = found.docs?.[0] as { data?: Record<string, unknown> } | undefined
  const manifest = channel?.data?.sealedManifest as SealedManifest | undefined

  if (!manifest) return Response.json({ error: 'No sealed manifest for this slug' }, { status: 404 })

  // Published, signed releases are meant to be read + shared; cache at the edge.
  return Response.json(manifest, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400' },
  })
}
