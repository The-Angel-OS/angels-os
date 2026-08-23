'use server'

/**
 * Works Studio — Server Actions
 *
 * A "Work" draft (the mutable workshop, per docs/WORKS_ENGINE.md) is stored in a
 * Channel's `data.workDraft` (manifest-shaped JSON). We reuse Channels (type
 * 'general' + a workDraft marker) rather than a new collection — no schema change,
 * tenant-scoped, and it already has the debounced-PATCH persistence path the editor
 * uses. Sealing into a signed content-addressed manifest is a later slice.
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { fetchDefaultSpaceId } from '@/utilities/fetchDefaultSpaceId'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { getWorks, isWorkAvailable } from '@/works/registry'

export interface WorksActionResult {
  success: boolean
  error?: string
  id?: string
}

export type WorkMedia = 'doc' | 'primer' | 'book' | 'audio' | 'video' | 'quest'

export interface WorkSummary {
  id: string
  title: string
  media: WorkMedia
  pageCount: number
  updatedAt: string | null
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled'

async function getAuthorizedTenant() {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) return { payload, user: null, tenantId: null, error: 'Not authenticated' }

  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) return { payload, user, tenantId: null, error: 'No tenant context' }

  if (!checkRole(ADMIN_ROLES, user)) {
    const m = await payload.find({
      collection: 'tenant-memberships' as any,
      where: {
        and: [{ user: { equals: user.id } }, { tenant: { equals: tenantId } }, { status: { equals: 'active' } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = m.docs?.[0] as any
    const ok = doc?.role === 'tenant_admin' || (Array.isArray(doc?.permissions) && doc.permissions.includes('manage_content'))
    if (!ok) return { payload, user, tenantId, error: 'Insufficient permissions' }
  }
  return { payload, user, tenantId, error: null }
}

/** List the tenant's Work drafts (channels carrying a data.workDraft). */
export async function listWorks(): Promise<WorkSummary[]> {
  const { payload, tenantId, error } = await getAuthorizedTenant()
  if (error || !tenantId) return []

  const channels = await payload.find({
    collection: 'channels',
    where: { tenant: { equals: tenantId } },
    limit: 200,
    depth: 0,
    sort: '-updatedAt',
    overrideAccess: true,
  })

  return (channels.docs || [])
    .map((c: any) => {
      const wd = c?.data?.workDraft
      if (!wd || typeof wd !== 'object') return null
      return {
        id: String(c.id),
        title: wd.title || c.name || 'Untitled',
        media: (wd.media || 'doc') as WorkMedia,
        pageCount: Array.isArray(wd.pages) ? wd.pages.length : 0,
        updatedAt: c.updatedAt || null,
      }
    })
    .filter(Boolean) as WorkSummary[]
}

export interface SealResult extends WorksActionResult {
  slug?: string
  version?: number
  manifestUrl?: string
  languages?: string[]
}

/** Seal a Work draft into a signed, multilingual release (server-side). */
export async function sealWork(channelId: string): Promise<SealResult> {
  const { payload, user, tenantId, error } = await getAuthorizedTenant()
  if (error || !tenantId || !user) return { success: false, error: error || 'Unauthorized' }

  // Reuse the endpoint's logic by calling its handler inline would require a
  // Request; instead we import the seal utilities directly for a clean server path.
  const { getOrCreateFederationKeyPair } = await import('@/federation/keyStore')
  const { sealWork: seal } = await import('@/utilities/worksSeal')

  const channel = (await payload.findByID({
    collection: 'channels',
    id: channelId,
    depth: 0,
    overrideAccess: true,
  })) as { id: string | number; slug?: string; tenant?: string | number; data?: Record<string, unknown> } | null
  if (!channel) return { success: false, error: 'Work not found' }
  if (String(channel.tenant) !== String(tenantId)) return { success: false, error: 'Wrong tenant' }

  const data = (channel.data && typeof channel.data === 'object' ? channel.data : {}) as Record<string, unknown>
  const draft = data.workDraft as Parameters<typeof seal>[0]['draft'] | undefined
  if (!draft || !Array.isArray(draft.pages) || draft.pages.length === 0) {
    return { success: false, error: 'Add at least one page before sealing' }
  }

  try {
    const keyPair = await getOrCreateFederationKeyPair(payload, Number(tenantId))
    const slug = channel.slug || `work-${channel.id}`
    const previousVersion = typeof data.sealedVersion === 'number' ? data.sealedVersion : 0
    const { manifest, verified } = seal({
      draft,
      slug,
      signerPublicKey: keyPair.publicKey,
      signerPrivateKey: keyPair.privateKey,
      previousVersion,
    })
    if (!verified) return { success: false, error: 'Seal failed self-verification' }

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
      } as any,
      overrideAccess: true,
    })

    return {
      success: true,
      slug,
      version: manifest.version,
      languages: manifest.languages.map((l) => l.code),
      manifestUrl: `/api/works-ops/manifest?slug=${encodeURIComponent(slug)}`,
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Seal failed' }
  }
}

/** Auto-translate a Work draft into the platform default languages. */
export async function translateWork(channelId: string, languages?: string[]): Promise<WorksActionResult & { added?: string[] }> {
  const { payload, user, tenantId, error } = await getAuthorizedTenant()
  if (error || !tenantId || !user) return { success: false, error: error || 'Unauthorized' }

  const { translateWorkDraft } = await import('@/utilities/worksTranslate')
  const { PLATFORM_DEFAULT_LANGUAGES } = await import('@/config/platformLanguages')

  const channel = (await payload.findByID({
    collection: 'channels',
    id: channelId,
    depth: 0,
    overrideAccess: true,
  })) as { id: string | number; tenant?: string | number; data?: Record<string, unknown> } | null
  if (!channel) return { success: false, error: 'Work not found' }
  if (String(channel.tenant) !== String(tenantId)) return { success: false, error: 'Wrong tenant' }

  const data = (channel.data && typeof channel.data === 'object' ? channel.data : {}) as Record<string, unknown>
  const draft = data.workDraft as Parameters<typeof translateWorkDraft>[0] | undefined
  if (!draft || !Array.isArray(draft.pages) || draft.pages.length === 0) {
    return { success: false, error: 'This work has no pages to translate' }
  }

  try {
    const targetLangs = (languages ?? PLATFORM_DEFAULT_LANGUAGES).filter((c) => c !== draft.defaultLanguage)
    const result = await translateWorkDraft(draft, { targetLangs })
    if (result.added.length > 0) {
      await payload.update({
        collection: 'channels',
        id: channel.id,
        data: { data: { ...data, workDraft: result.draft } } as any,
        overrideAccess: true,
      })
    }
    return { success: true, added: result.added }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Translation failed' }
  }
}

/** Create a new empty Work draft (a 'general' channel with a workDraft payload). */
export async function createWork(title: string): Promise<WorksActionResult> {
  const { payload, tenantId, error } = await getAuthorizedTenant()
  if (error || !tenantId) return { success: false, error: error || 'Unauthorized' }

  const cleanTitle = (title || '').trim() || 'Untitled Work'
  const spaceId = await fetchDefaultSpaceId(tenantId)
  if (!spaceId) return { success: false, error: 'No space found for this tenant' }

  try {
    const created = await payload.create({
      collection: 'channels',
      data: {
        name: cleanTitle,
        // suffix keeps the channel slug unique even for same-titled works
        slug: `work-${slugify(cleanTitle)}-${Date.now().toString(36)}`,
        space: spaceId,
        type: 'general',
        source: 'native',
        tenant: tenantId,
        data: {
          workDraft: {
            title: cleanTitle,
            subtitle: '',
            media: 'doc',
            languages: [{ code: 'en', name: 'English', rtl: false }],
            defaultLanguage: 'en',
            pages: [],
          },
        },
      } as any,
      overrideAccess: true,
    })
    return { success: true, id: String(created.id) }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create work' }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * The shelf — which Works from the catalog THIS portal carries.
 *
 * This used to be a `subscribers` array in a TypeScript manifest, so choosing
 * was an edit-and-deploy only the platform operator could do. It is a `works`
 * row now, which is what makes this screen possible at all.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface ShelfWork {
  slug: string
  title: string
  subtitle: string
  type: 'document' | 'book'
  /** Owning endeavor's slug. */
  owner: string
  /** Showing on this portal right now. */
  carried: boolean
  /** False for a Work this portal OWNS — an owner always carries its own. */
  canToggle: boolean
}

/** Every catalog Work, with whether this portal currently carries it. */
export async function listShelf(): Promise<ShelfWork[]> {
  const { error } = await getAuthorizedTenant()
  if (error) return []
  const { tenant } = await resolveTenantFromHeaders()
  const slug = (tenant as { slug?: string } | null)?.slug ?? null
  if (!slug) return []

  const works = await getWorks()
  return works
    .filter((w) => w.published)
    .map((w) => ({
      slug: w.id,
      title: w.title,
      subtitle: w.subtitle,
      type: w.bookSlug ? ('book' as const) : ('document' as const),
      owner: w.owner,
      carried: isWorkAvailable(w, slug),
      canToggle: w.owner !== slug,
    }))
}

/** Switch a Work on or off for THIS portal. */
export async function setWorkCarried(workSlug: string, carried: boolean): Promise<WorksActionResult> {
  const { payload, error } = await getAuthorizedTenant()
  if (error) return { success: false, error }
  const { tenant } = await resolveTenantFromHeaders()
  const slug = (tenant as { slug?: string } | null)?.slug ?? null
  if (!slug) return { success: false, error: 'No portal context' }

  const found = await payload.find({
    collection: 'works',
    where: { slug: { equals: workSlug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const row = found.docs?.[0] as
    | { id: number | string; owner?: string; subscribers?: unknown; optOuts?: unknown; availableGlobally?: boolean }
    | undefined
  if (!row) return { success: false, error: 'Work not found' }
  if (row.owner === slug) return { success: false, error: 'This portal owns this work — it always carries it.' }

  const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]).filter((s) => typeof s === 'string') : [])
  let subscribers = arr(row.subscribers)
  let optOuts = arr(row.optOuts)

  if (carried) {
    optOuts = optOuts.filter((s) => s !== slug)
    // A globally-offered Work needs no subscription — dropping the opt-out is enough.
    if (!row.availableGlobally && !subscribers.includes(slug)) subscribers = [...subscribers, slug]
  } else {
    subscribers = subscribers.filter((s) => s !== slug)
    if (!optOuts.includes(slug)) optOuts = [...optOuts, slug]
  }

  try {
    await payload.update({
      collection: 'works',
      id: row.id,
      data: { subscribers, optOuts } as never,
      overrideAccess: true, // authorization is getAuthorizedTenant + the owner check above
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to update' }
  }
}
