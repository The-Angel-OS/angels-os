import React from 'react'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { ADMIN_ROLES, checkRole } from '@/access/utilities'
import { getOwnedPortals, quotaFromOwned, type OwnedPortal } from '@/utilities/portalQuota'
import { planOf, type PortalPlan } from '@/utilities/portalPlan'
import { UserPortalsClient, type PortalCardItem } from './UserPortalsClient'

export interface UserPortalsBlockProps {
  heading?: string | null
  subheading?: string | null
  scope?: 'owned' | 'all_for_admin' | null
  columns?: '2' | '3' | '4' | null
  showQuota?: boolean | null
  showFilters?: boolean | null
  showCreateCard?: boolean | null
  hideWhenAnonymous?: boolean | null
  includePlatformTenant?: boolean | null
}

const PLAN_LABELS: Record<PortalPlan, string> = {
  free: 'Starter Free',
  creator: 'Creator ($10)',
  site: 'Pro ($29)',
  business: 'Studio ($79)',
  agency: 'Agency',
  demo: 'Demo',
}

interface RawTenantDoc {
  id: number | string
  slug?: string | null
  name?: string | null
  domain?: string | null
  status?: string | null
  type?: string | null
  portalPlan?: string | null
  isGuardianAngel?: boolean | null
  createdAt?: string | null
  branding?: {
    siteName?: string | null
    tagline?: string | null
  } | null
}

export function buildPortalCardItems(opts: {
  owned: OwnedPortal[]
  allTenants?: RawTenantDoc[]
  isSuperAdmin: boolean
  scope?: 'owned' | 'all_for_admin' | null
  includePlatformTenant?: boolean | null
}): PortalCardItem[] {
  const { owned, allTenants = [], isSuperAdmin, scope = 'all_for_admin', includePlatformTenant = false } = opts
  const ownedMap = new Map<string, OwnedPortal>()
  for (const o of owned) {
    if (o.id != null) ownedMap.set(String(o.id), o)
  }

  const byTenantId = new Map<string, RawTenantDoc>()
  for (const t of allTenants) {
    if (t?.id != null) byTenantId.set(String(t.id), t)
  }

  const useAllForAdmin = isSuperAdmin && scope !== 'owned' && allTenants.length > 0
  const sourceRows: Array<{
    id: string
    slug: string
    name: string
    domain: string
    tagline?: string | null
    status: string
    type: string
    plan: PortalPlan
    isGuardianAngel: boolean
    relationship: 'owner' | 'platform_admin'
    createdAt?: string | null
  }> = []

  if (useAllForAdmin) {
    for (const t of allTenants) {
      const idStr = String(t.id)
      const slug = (t.slug || '').trim()
      if (!slug) continue
      if (!includePlatformTenant && slug === 'platform') continue
      const plan = planOf(t as { portalPlan?: string | null })
      const domain = (t.domain || `${slug}.spacesangels.com`).trim()
      sourceRows.push({
        id: idStr,
        slug,
        name: t.branding?.siteName || t.name || slug,
        domain,
        tagline: t.branding?.tagline ?? null,
        status: t.status || 'active',
        type: t.type || 'tenant',
        plan,
        isGuardianAngel: t.isGuardianAngel === true || t.type === 'guardian_angel',
        relationship: ownedMap.has(idStr) ? 'owner' : 'platform_admin',
        createdAt: t.createdAt ?? null,
      })
    }
  } else {
    for (const o of owned) {
      const idStr = String(o.id)
      const hydrated = byTenantId.get(idStr)
      const slug = (hydrated?.slug || o.slug || '').trim()
      if (!slug) continue
      if (!includePlatformTenant && slug === 'platform') continue
      const plan = hydrated ? planOf(hydrated as { portalPlan?: string | null }) : o.plan
      const domain = (hydrated?.domain || o.domain || `${slug}.spacesangels.com`).trim()
      sourceRows.push({
        id: idStr,
        slug,
        name: hydrated?.branding?.siteName || hydrated?.name || o.name || slug,
        domain,
        tagline: hydrated?.branding?.tagline ?? null,
        status: hydrated?.status || 'active',
        type: hydrated?.type || (o.isGuardianAngel ? 'guardian_angel' : 'tenant'),
        plan,
        isGuardianAngel: Boolean(hydrated?.isGuardianAngel ?? o.isGuardianAngel),
        relationship: 'owner',
        createdAt: hydrated?.createdAt ?? null,
      })
    }
  }

  return sourceRows.map((row) => {
    const baseUrl = row.domain.startsWith('http') ? row.domain : `https://${row.domain}`
    const cleanBase = baseUrl.replace(/\/+$/, '')
    return {
      ...row,
      planLabel: PLAN_LABELS[row.plan] || row.plan,
      siteUrl: cleanBase,
      dashboardUrl: `${cleanBase}/dashboard`,
      settingsUrl: `${cleanBase}/dashboard/admin/settings`,
      ...(isSuperAdmin ? { adminUrl: `${cleanBase}/admin/collections/tenants/${row.id}` } : {}),
    }
  })
}

export async function UserPortalsBlockComponent(props: UserPortalsBlockProps) {
  const {
    heading = 'Your Portals',
    subheading,
    scope = 'all_for_admin',
    columns = '3',
    showQuota = true,
    showFilters = true,
    showCreateCard = true,
    hideWhenAnonymous = true,
    includePlatformTenant = false,
  } = props

  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: await headers() })

    if (!user) {
      if (hideWhenAnonymous !== false) return null
      return (
        <UserPortalsClient
          heading={heading}
          subheading={subheading}
          portals={[]}
          columns={columns}
          showQuota={showQuota}
          showFilters={showFilters}
          showCreateCard={showCreateCard}
          isAuthenticated={false}
        />
      )
    }

    const isSuperAdmin = checkRole(['super_admin'], user) || checkRole(ADMIN_ROLES, user)
    const owned = await getOwnedPortals(payload, user.id)
    const quota = quotaFromOwned(owned)

    let allTenants: RawTenantDoc[] = []
    if (isSuperAdmin && scope !== 'owned') {
      const res = await payload.find({
        collection: 'tenants',
        limit: 200,
        sort: 'id',
        depth: 0,
        overrideAccess: true,
      })
      allTenants = (res.docs || []) as unknown as RawTenantDoc[]
    } else if (owned.length > 0) {
      const ownedIds = owned.map((o) => o.id).filter((id) => id !== 0 && id !== '')
      if (ownedIds.length > 0) {
        const res = await payload.find({
          collection: 'tenants',
          where: { id: { in: ownedIds } },
          limit: 200,
          sort: 'id',
          depth: 0,
          overrideAccess: true,
        })
        allTenants = (res.docs || []) as unknown as RawTenantDoc[]
      }
    }

    const portals = buildPortalCardItems({
      owned,
      allTenants,
      isSuperAdmin,
      scope,
      includePlatformTenant,
    })

    if (portals.length === 0 && !showCreateCard) {
      return null
    }

    return (
      <UserPortalsClient
        heading={heading}
        subheading={subheading}
        portals={portals}
        columns={columns}
        showQuota={showQuota}
        showFilters={showFilters}
        showCreateCard={showCreateCard}
        quota={quota}
        isSuperAdmin={isSuperAdmin}
        isAuthenticated
      />
    )
  } catch {
    return null
  }
}
