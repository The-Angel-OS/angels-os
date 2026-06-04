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
