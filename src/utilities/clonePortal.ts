/**
 * clonePortal — Clone a live source portal (tenant) into a NEW tenant.
 *
 * Rebrands text and re-uploads media into the NEW tenant's Vercel Blob (by
 * creating fresh Media docs via the Local API, so the storage adapter runs and
 * writes to the new tenant's blob path). SAFETY IS PARAMOUNT:
 *
 *   - DRY RUN by default (`execute !== true`) — counts only, writes NOTHING.
 *   - Reads the source with `overrideAccess` but only ever CREATES new rows in
 *     the target tenant. It NEVER updates/deletes anything in the source, so a
 *     bad clone can't corrupt the source.
 *   - EXPLICIT id remapping only. We remap the specific relationship fields we
 *     verified against the collection schemas (channel→space, hero/meta/gallery
 *     →media, endeavor logo/cover, tenant branding logo/favicon). There is NO
 *     generic "replace any number that equals an old id" pass — that would risk
 *     corrupting prices, counts, percentages, etc.
 *   - Fail-soft per item: one bad row warns + records an 'error' step; the whole
 *     clone never throws.
 *
 * NOT cloned (by design): messages, orders, bookings, users, memberships. Only
 * the portal's presentation/content surface is copied.
 *
 * Field-name provenance (read from the schemas before writing this):
 *   - Channels.space          → src/collections/Channels/index.ts:48 (relationTo 'spaces')
 *   - Pages hero image        → src/fields/hero.ts:62 (hero.media) via Pages tab
 *   - Pages meta image        → src/collections/Pages/index.ts:193 (meta.image)
 *   - Posts hero/meta image   → same hero field + src/collections/Posts/index.ts:125
 *   - Products gallery image  → src/collections/Products/index.ts:132 (gallery[].image)
 *   - Products meta / cadFile → src/collections/Products/index.ts:229 / :303
 *   - Services image          → src/collections/Services/index.ts:42
 *   - Endeavor logo/cover     → src/collections/Endeavors/index.ts:495 / :503
 *   - Endeavor primarySpace   → src/collections/Endeavors/index.ts:169
 *   - Tenant branding         → src/collections/Tenants/index.ts:105 (branding.logo/favicon)
 */

import type { Payload } from 'payload'

// ── Public types ─────────────────────────────────────────────────────────────

export type CloneInclude =
  | 'branding'
  | 'media'
  | 'spaces'
  | 'channels'
  | 'pages'
  | 'products'
  | 'posts'
  | 'endeavor'

export interface ClonePortalInput {
  sourceSlug: string
  targetName: string
  targetDomain: string
  targetSlug?: string
  /** Default: all of ['branding','media','spaces','channels','pages','products','posts','endeavor']. */
  include?: CloneInclude[]
  /** Literal, case-insensitive string replacements across the text fields we rebrand. */
  rebrand?: Array<{ from: string; to: string }>
  /** Default true — fetch source media bytes and re-upload into the new tenant's blob. */
  copyMedia?: boolean
  /** Default false → DRY RUN (report counts only, write nothing). */
  execute?: boolean
}

export interface ClonePortalStep {
  collection: string
  count: number
  status: 'counted' | 'created' | 'skipped' | 'error'
  error?: string
}

export interface ClonePortalResult {
  found: boolean
  sourceSlug: string
  targetSlug: string
  targetTenantId?: number | string
  dryRun: boolean
  steps: ClonePortalStep[]
  warnings: string[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_INCLUDE: CloneInclude[] = [
  'branding',
  'media',
  'spaces',
  'channels',
  'pages',
  'products',
  'posts',
  'endeavor',
]

const FIND_LIMIT = 10000

// ── Small helpers ────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60) || 'portal'
}

/** Extract a plain id from a relationship value (id | { id } | polymorphic). */
function relId(value: unknown): number | string | undefined {
  if (value == null) return undefined
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    if (v.id != null && (typeof v.id === 'number' || typeof v.id === 'string')) return v.id
    if (v.value != null && (typeof v.value === 'number' || typeof v.value === 'string')) return v.value
  }
  return undefined
}

// ── Rebrand ──────────────────────────────────────────────────────────────────

/** Case-insensitive literal replacement of each {from,to} across a single string. */
function makeRebrander(rules?: Array<{ from: string; to: string }>) {
  const clean = (rules || []).filter((r) => r && typeof r.from === 'string' && r.from.length > 0)
  return (value: unknown): string => {
    if (typeof value !== 'string' || clean.length === 0) return typeof value === 'string' ? value : ''
    let out = value
    for (const r of clean) {
      // Escape regex metachars so `from` is treated literally.
      const escaped = r.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      out = out.replace(new RegExp(escaped, 'gi'), r.to ?? '')
    }
    return out
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function clonePortal(
  payload: Payload,
  input: ClonePortalInput,
): Promise<ClonePortalResult> {
  const include = new Set<CloneInclude>(
    input.include && input.include.length ? input.include : DEFAULT_INCLUDE,
  )
  const copyMedia = input.copyMedia !== false
  const dryRun = input.execute !== true
  const targetSlug = slugify(input.targetSlug || input.targetName)
  const rebrand = makeRebrander(input.rebrand)

  const result: ClonePortalResult = {
    found: false,
    sourceSlug: input.sourceSlug,
    targetSlug,
    dryRun,
    steps: [],
    warnings: [],
  }

  const warn = (msg: string) => result.warnings.push(msg)
  const step = (s: ClonePortalStep) => result.steps.push(s)

  // ── 1. Resolve source tenant ───────────────────────────────────────────────
  let sourceTenant: Record<string, unknown> | undefined
  try {
    const found = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: input.sourceSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    sourceTenant = found.docs?.[0] as unknown as Record<string, unknown> | undefined
  } catch (e) {
    warn(`Failed to resolve source tenant: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!sourceTenant) {
    result.found = false
    return result
  }
  result.found = true
  const sourceTenantId = sourceTenant.id as number | string

  // Load all source collections once (used by both dry-run counting and execute).
  const sourceFind = async (collection: string) => {
    try {
      const res = await payload.find({
        collection: collection as never,
        where: { tenant: { equals: sourceTenantId } },
        limit: FIND_LIMIT,
        depth: 0,
        overrideAccess: true,
      })
      return res.docs as Array<Record<string, unknown>>
    } catch (e) {
      warn(`Failed to read source ${collection}: ${e instanceof Error ? e.message : String(e)}`)
      return [] as Array<Record<string, unknown>>
    }
  }

  const [srcMedia, srcSpaces, srcChannels, srcPages, srcProducts, srcPosts, srcEndeavors] =
    await Promise.all([
      include.has('media') ? sourceFind('media') : Promise.resolve([]),
      include.has('spaces') || include.has('channels') || include.has('endeavor')
        ? sourceFind('spaces')
        : Promise.resolve([]),
      include.has('channels') ? sourceFind('channels') : Promise.resolve([]),
      include.has('pages') ? sourceFind('pages') : Promise.resolve([]),
      include.has('products') ? sourceFind('products') : Promise.resolve([]),
      include.has('posts') ? sourceFind('posts') : Promise.resolve([]),
      include.has('endeavor') ? sourceFind('endeavors') : Promise.resolve([]),
    ])

  const srcServices = include.has('products') ? await sourceFind('services') : []

  // ── 2. DRY RUN — count only, write nothing ──────────────────────────────────
  if (dryRun) {
    if (include.has('branding')) step({ collection: 'tenant (branding)', count: 1, status: 'counted' })
    if (include.has('media')) step({ collection: 'media', count: srcMedia.length, status: 'counted' })
    if (include.has('spaces')) step({ collection: 'spaces', count: srcSpaces.length, status: 'counted' })
    if (include.has('channels')) step({ collection: 'channels', count: srcChannels.length, status: 'counted' })
    if (include.has('pages')) step({ collection: 'pages', count: srcPages.length, status: 'counted' })
    if (include.has('products')) {
      step({ collection: 'products', count: srcProducts.length, status: 'counted' })
      step({ collection: 'services', count: srcServices.length, status: 'counted' })
    }
    if (include.has('posts')) step({ collection: 'posts', count: srcPosts.length, status: 'counted' })
    if (include.has('endeavor')) step({ collection: 'endeavors', count: srcEndeavors.length, status: 'counted' })
    return result
  }

  // ── 3. EXECUTE — create in dependency order, building old→new id maps ────────

  // 3a. Tenant / branding
  const srcBranding = (sourceTenant.branding as Record<string, unknown> | undefined) || {}
  let targetTenantId: number | string | undefined
  try {
    const existing = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: targetSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs?.[0]) {
      targetTenantId = existing.docs[0].id as number | string
      warn(`Tenant with slug "${targetSlug}" already exists (#${targetTenantId}); reusing it.`)
      step({ collection: 'tenant (branding)', count: 1, status: 'skipped' })
    } else {
      // Copy the branding group (minus media refs — remapped after media step),
      // applying rebrand to human-readable text.
      const brandingData: Record<string, unknown> = include.has('branding')
        ? {
            ...srcBranding,
            logo: undefined,
            favicon: undefined,
            siteName: rebrand(srcBranding.siteName ?? input.targetName),
            tagline: rebrand(srcBranding.tagline),
          }
        : {}
      // Strip empty strings produced by rebrand of undefined.
      if (!brandingData.siteName) brandingData.siteName = input.targetName
      if (brandingData.tagline === '') delete brandingData.tagline

      const created = await payload.create({
        collection: 'tenants',
        data: {
          type: (sourceTenant.type as string) === 'platform' ? 'tenant' : (sourceTenant.type as string) || 'tenant',
          name: rebrand(sourceTenant.name) || input.targetName,
          slug: targetSlug,
          domain: input.targetDomain,
          status: 'active',
          ...(include.has('branding') ? { branding: brandingData } : {}),
          businessType: sourceTenant.businessType,
        } as never,
        overrideAccess: true,
      })
      targetTenantId = created.id as number | string
      step({ collection: 'tenant (branding)', count: 1, status: 'created' })
    }
  } catch (e) {
    step({ collection: 'tenant (branding)', count: 0, status: 'error', error: e instanceof Error ? e.message : String(e) })
    warn(`Fatal: could not create/resolve target tenant — aborting clone.`)
    return result
  }
  if (!targetTenantId) return result
  result.targetTenantId = targetTenantId

  // 3b. Media — fetch bytes from source url, re-upload into the new tenant's blob.
  const mediaMap = new Map<string | number, string | number>()
  if (include.has('media') && copyMedia) {
    let created = 0
    for (const m of srcMedia) {
      const url = typeof m.url === 'string' ? m.url : ''
      const filename = (typeof m.filename === 'string' && m.filename) || `media-${relId(m.id)}`
      const mimetype = (typeof m.mimeType === 'string' && m.mimeType) || 'application/octet-stream'
      try {
        if (!url || !/^https?:\/\//i.test(url)) {
          warn(`media #${relId(m.id)} (${filename}): no fetchable url — skipped.`)
          continue
        }
        const res = await fetch(url)
        if (!res.ok) {
          warn(`media #${relId(m.id)} (${filename}): fetch ${res.status} — skipped.`)
          continue
        }
        const buf = Buffer.from(await res.arrayBuffer())
        const newMedia = await payload.create({
          collection: 'media',
          data: {
            alt: rebrand(m.alt) || (typeof m.alt === 'string' ? m.alt : filename),
            tenant: targetTenantId,
          } as never,
          file: { data: buf, mimetype, name: filename, size: buf.length },
          overrideAccess: true,
        })
        const srcId = relId(m.id)
        if (srcId != null) mediaMap.set(srcId, newMedia.id as string | number)
        created++
      } catch (e) {
        warn(`media #${relId(m.id)} (${filename}): ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    step({ collection: 'media', count: created, status: 'created' })
  } else if (include.has('media')) {
    step({ collection: 'media', count: 0, status: 'skipped' })
  }

  /** Remap a media id via the media map; undefined if unmapped (so we drop the ref). */
  const mapMedia = (value: unknown): string | number | undefined => {
    const id = relId(value)
    if (id == null) return undefined
    return mediaMap.get(id)
  }

  // 3c. Spaces
  const spaceMap = new Map<string | number, string | number>()
  if (include.has('spaces')) {
    let created = 0
    for (const s of srcSpaces) {
      try {
        const { id, tenant: _t, createdAt: _c, updatedAt: _u, ...rest } = s
        const newSpace = await payload.create({
          collection: 'spaces',
          data: {
            ...rest,
            name: rebrand(s.name) || (s.name as string),
            description: s.description != null ? rebrand(s.description) : undefined,
            tenant: targetTenantId,
          } as never,
          overrideAccess: true,
        })
        const srcId = relId(id)
        if (srcId != null) spaceMap.set(srcId, newSpace.id as string | number)
        created++
      } catch (e) {
        warn(`space #${relId(s.id)}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    step({ collection: 'spaces', count: created, status: 'created' })
  }

  // 3d. Channels — remap the `space` reference (Channels/index.ts:48).
  if (include.has('channels')) {
    let created = 0
    for (const c of srcChannels) {
      try {
        const { id: _id, tenant: _t, createdAt: _c, updatedAt: _u, space, ...rest } = c
        const mappedSpace = spaceMap.get(relId(space) as string | number)
        if (relId(space) != null && mappedSpace == null) {
          warn(`channel #${relId(c.id)} (${String(c.name)}): source space not cloned — skipped.`)
          continue
        }
        await payload.create({
          collection: 'channels',
          data: {
            ...rest,
            name: rebrand(c.name) || (c.name as string),
            description: c.description != null ? rebrand(c.description) : undefined,
            space: mappedSpace,
            tenant: targetTenantId,
          } as never,
          overrideAccess: true,
        })
        created++
      } catch (e) {
        warn(`channel #${relId(c.id)}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    step({ collection: 'channels', count: created, status: 'created' })
  }

  let deepLayoutMediaWarned = false
  const warnDeepLayoutOnce = () => {
    if (!deepLayoutMediaWarned) {
      deepLayoutMediaWarned = true
      warn('page/post layout blocks may reference media deep inside them — those refs are left as-is and may need a manual relink.')
    }
  }

  // 3e. Pages — remap hero.media (hero.ts:62) + meta.image (Pages/index.ts:193).
  if (include.has('pages')) {
    let created = 0
    for (const p of srcPages) {
      try {
        const { id: _id, tenant: _t, createdAt: _c, updatedAt: _u, ...rest } = p
        const hero = (p.hero as Record<string, unknown> | undefined) || undefined
        const meta = (p.meta as Record<string, unknown> | undefined) || undefined
        const newHero = hero
          ? { ...hero, media: hero.media != null ? mapMedia(hero.media) ?? undefined : hero.media }
          : undefined
        const newMeta = meta
          ? { ...meta, image: meta.image != null ? mapMedia(meta.image) ?? undefined : meta.image, title: meta.title != null ? rebrand(meta.title) : meta.title }
          : undefined
        if (Array.isArray(p.layout) && (p.layout as unknown[]).length) warnDeepLayoutOnce()
        await payload.create({
          collection: 'pages',
          data: {
            ...rest,
            title: rebrand(p.title) || (p.title as string),
            slug: p.slug ? slugify(rebrand(p.slug)) : p.slug,
            ...(newHero ? { hero: newHero } : {}),
            ...(newMeta ? { meta: newMeta } : {}),
            tenant: targetTenantId,
          } as never,
          overrideAccess: true,
        })
        created++
      } catch (e) {
        warn(`page #${relId(p.id)} (${String(p.slug)}): ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    step({ collection: 'pages', count: created, status: 'created' })
  }

  // 3f. Products + Services
  if (include.has('products')) {
    // Products — remap gallery[].image (Products/index.ts:132), meta.image (:229), cadFile (:303).
    let productsCreated = 0
    for (const pr of srcProducts) {
      try {
        const { id: _id, tenant: _t, createdAt: _c, updatedAt: _u, ...rest } = pr
        const gallery = Array.isArray(pr.gallery)
          ? (pr.gallery as Array<Record<string, unknown>>).map((g) => ({
              ...g,
              image: g.image != null ? mapMedia(g.image) ?? undefined : g.image,
            }))
          : undefined
        const meta = (pr.meta as Record<string, unknown> | undefined) || undefined
        const newMeta = meta
          ? { ...meta, image: meta.image != null ? mapMedia(meta.image) ?? undefined : meta.image, title: meta.title != null ? rebrand(meta.title) : meta.title }
          : undefined
        if (Array.isArray(pr.layout) && (pr.layout as unknown[]).length) warnDeepLayoutOnce()
        await payload.create({
          collection: 'products' as never,
          data: {
            ...rest,
            title: rebrand(pr.title) || (pr.title as string),
            slug: pr.slug ? slugify(rebrand(pr.slug)) : pr.slug,
            ...(gallery ? { gallery } : {}),
            ...(newMeta ? { meta: newMeta } : {}),
            cadFile: pr.cadFile != null ? mapMedia(pr.cadFile) ?? undefined : pr.cadFile,
            // Drop cross-tenant references that don't survive a clone.
            vendor: undefined,
            relatedProducts: undefined,
            tenant: targetTenantId,
          } as never,
          overrideAccess: true,
        })
        productsCreated++
      } catch (e) {
        warn(`product #${relId(pr.id)} (${String(pr.slug)}): ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    step({ collection: 'products', count: productsCreated, status: 'created' })

    // Services — remap `image` (Services/index.ts:42).
    let servicesCreated = 0
    for (const sv of srcServices) {
      try {
        const { id: _id, tenant: _t, createdAt: _c, updatedAt: _u, ...rest } = sv
        await payload.create({
          collection: 'services' as never,
          data: {
            ...rest,
            label: rebrand(sv.label) || (sv.label as string),
            description: sv.description != null ? rebrand(sv.description) : undefined,
            image: sv.image != null ? mapMedia(sv.image) ?? undefined : sv.image,
            tenant: targetTenantId,
          } as never,
          overrideAccess: true,
        })
        servicesCreated++
      } catch (e) {
        warn(`service #${relId(sv.id)} (${String(sv.label)}): ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    step({ collection: 'services', count: servicesCreated, status: 'created' })
  }

  // 3g. Posts — remap hero.media + meta.image, rebrand title/text.
  if (include.has('posts')) {
    let created = 0
    for (const po of srcPosts) {
      try {
        const { id: _id, tenant: _t, createdAt: _c, updatedAt: _u, ...rest } = po
        const hero = (po.hero as Record<string, unknown> | undefined) || undefined
        const meta = (po.meta as Record<string, unknown> | undefined) || undefined
        const newHero = hero
          ? { ...hero, media: hero.media != null ? mapMedia(hero.media) ?? undefined : hero.media }
          : undefined
        const newMeta = meta
          ? { ...meta, image: meta.image != null ? mapMedia(meta.image) ?? undefined : meta.image, title: meta.title != null ? rebrand(meta.title) : meta.title }
          : undefined
        if (Array.isArray(po.layout) && (po.layout as unknown[]).length) warnDeepLayoutOnce()
        await payload.create({
          collection: 'posts',
          data: {
            ...rest,
            title: rebrand(po.title) || (po.title as string),
            slug: po.slug ? slugify(rebrand(po.slug)) : po.slug,
            ...(newHero ? { hero: newHero } : {}),
            ...(newMeta ? { meta: newMeta } : {}),
            // Cross-post references point at source ids; drop them.
            relatedPosts: undefined,
            tenant: targetTenantId,
          } as never,
          overrideAccess: true,
        })
        created++
      } catch (e) {
        warn(`post #${relId(po.id)} (${String(po.slug)}): ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    step({ collection: 'posts', count: created, status: 'created' })
  }

  // 3h. Endeavor — remap logo/coverImage + primarySpace; create or update the target's.
  if (include.has('endeavor')) {
    const src = srcEndeavors[0]
    if (src) {
      try {
        const { id: _id, tenant: _t, createdAt: _c, updatedAt: _u, ...rest } = src
        const endeavorData: Record<string, unknown> = {
          ...rest,
          name: rebrand(src.name) || (src.name as string),
          tagline: src.tagline != null ? rebrand(src.tagline) : undefined,
          description: src.description != null ? rebrand(src.description) : undefined,
          missionStatement: src.missionStatement != null ? rebrand(src.missionStatement) : undefined,
          logo: src.logo != null ? mapMedia(src.logo) ?? undefined : src.logo,
          coverImage: src.coverImage != null ? mapMedia(src.coverImage) ?? undefined : src.coverImage,
          primarySpace:
            src.primarySpace != null
              ? spaceMap.get(relId(src.primarySpace) as string | number) ?? undefined
              : src.primarySpace,
          // The clone is a fresh federation identity — do not copy signatures/ids.
          federation: undefined,
          beneficiaries: undefined,
          tenant: targetTenantId,
        }
        const existing = await payload.find({
          collection: 'endeavors',
          where: { tenant: { equals: targetTenantId } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (existing.docs?.[0]) {
          const { tenant: _et, ...updateData } = endeavorData
          await payload.update({
            collection: 'endeavors',
            id: existing.docs[0].id,
            data: updateData as never,
            overrideAccess: true,
          })
        } else {
          await payload.create({
            collection: 'endeavors',
            data: endeavorData as never,
            overrideAccess: true,
          })
        }
        step({ collection: 'endeavors', count: 1, status: 'created' })
      } catch (e) {
        step({ collection: 'endeavors', count: 0, status: 'error', error: e instanceof Error ? e.message : String(e) })
        warn(`endeavor #${relId(src.id)}: ${e instanceof Error ? e.message : String(e)}`)
      }
    } else {
      step({ collection: 'endeavors', count: 0, status: 'skipped' })
    }
  }

  // 3i. Backfill tenant branding logo/favicon now that media exists.
  if (include.has('branding') && include.has('media')) {
    const logoId = mapMedia(srcBranding.logo)
    const faviconId = mapMedia(srcBranding.favicon)
    if (logoId != null || faviconId != null) {
      try {
        const current = await payload.findByID({
          collection: 'tenants',
          id: targetTenantId,
          depth: 0,
          overrideAccess: true,
        })
        const currentBranding = (current.branding as Record<string, unknown> | undefined) || {}
        await payload.update({
          collection: 'tenants',
          id: targetTenantId,
          data: {
            branding: {
              ...currentBranding,
              ...(logoId != null ? { logo: logoId } : {}),
              ...(faviconId != null ? { favicon: faviconId } : {}),
            },
          } as never,
          overrideAccess: true,
        })
      } catch (e) {
        warn(`branding logo/favicon relink: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  return result
}
