import { headers } from 'next/headers'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'
import { fetchTenantByDomain } from '@/utilities/fetchTenantByDomain'
import { BridgeConsole } from '@/components/dashboard/BridgeConsole'

/**
 * Enterprise Bridge — LEO command interface.
 * Server component: fetches system status data then renders the BridgeConsole client component.
 */
export default async function BridgePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const prefix = locale === 'en' ? '' : `/${locale}`

  type SystemStatusValue = 'online' | 'standby' | 'offline'
  let leoOnline = false
  let systems: { name: string; label: string; count: number; status: SystemStatusValue; color: string }[] = [
    { name: 'comms', label: 'Comms', count: 0, status: 'standby', color: 'var(--lcars-green)' },
    { name: 'cargo', label: 'Cargo Bay', count: 0, status: 'standby', color: 'var(--lcars-orange)' },
    { name: 'treasury', label: 'Treasury', count: 0, status: 'standby', color: 'var(--lcars-amber)' },
    { name: 'sensors', label: 'Sensors', count: 0, status: 'standby', color: 'var(--lcars-blue)' },
    { name: 'crew', label: 'Crew Relations', count: 0, status: 'standby', color: 'var(--lcars-lavender)' },
    { name: 'science', label: 'Science', count: 0, status: 'standby', color: 'var(--lcars-peach)' },
    { name: 'engineering', label: 'Engineering', count: 0, status: 'standby', color: 'var(--lcars-purple)' },
  ]

  try {
    const payload = await getPayload({ config })
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })

    if (!user) {
      redirect(`${prefix}/login?redirect=${encodeURIComponent(`${prefix}/dashboard/bridge`)}`)
    }

    // Only admins and business owners can access the Bridge
    const roles = (user as any).roles as string[] | undefined
    const isAdmin = Boolean(
      roles?.includes('super_admin') || roles?.includes('admin') || roles?.includes('archangel'),
    )
    const isBusinessOwner = Boolean(roles?.includes('producer'))
    if (!isAdmin && !isBusinessOwner) {
      redirect(`${prefix}/dashboard`)
    }

    // Resolve current tenant
    const tenantSlug = headersList.get('x-tenant-id')
    const host = headersList.get('host') ?? ''
    const currentTenant =
      (tenantSlug ? await fetchTenantBySlug(tenantSlug) : null) ??
      (await fetchTenantByDomain(host))

    const isSuperAdmin = Boolean(roles?.includes('super_admin'))
    const tenantFilter: Where | undefined =
      isSuperAdmin || !currentTenant
        ? undefined
        : { tenant: { equals: currentTenant.id } }

    // Check if LEO exists (system user for this tenant)
    const leoResult = await payload.find({
      collection: 'users',
      where: {
        and: [
          { isSystemUser: { equals: true } },
          ...(tenantFilter ? [tenantFilter] : []),
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }).catch(() => ({ totalDocs: 0 }))
    leoOnline = leoResult.totalDocs > 0

    // Fetch system counts in parallel
    const [spaces, products, orders, posts, users, bookings, events] = await Promise.all([
      payload.count({ collection: 'spaces', where: tenantFilter, overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'products', where: tenantFilter, overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'orders', where: tenantFilter, overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'posts', where: tenantFilter, overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'users', where: { isSystemUser: { not_equals: true } }, overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'bookings', where: tenantFilter, overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'events', where: tenantFilter, overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
    ])

    systems = [
      { name: 'comms', label: 'Comms', count: spaces.totalDocs, status: spaces.totalDocs > 0 ? 'online' : 'standby', color: 'var(--lcars-green)' },
      { name: 'cargo', label: 'Cargo Bay', count: products.totalDocs, status: products.totalDocs > 0 ? 'online' : 'standby', color: 'var(--lcars-orange)' },
      { name: 'treasury', label: 'Treasury', count: orders.totalDocs, status: orders.totalDocs > 0 ? 'online' : 'standby', color: 'var(--lcars-amber)' },
      { name: 'sensors', label: 'Sensors', count: posts.totalDocs, status: posts.totalDocs > 0 ? 'online' : 'standby', color: 'var(--lcars-blue)' },
      { name: 'crew', label: 'Crew Relations', count: users.totalDocs, status: users.totalDocs > 0 ? 'online' : 'standby', color: 'var(--lcars-lavender)' },
      { name: 'science', label: 'Science', count: bookings.totalDocs, status: bookings.totalDocs > 0 ? 'online' : 'standby', color: 'var(--lcars-peach)' },
      { name: 'engineering', label: 'Engineering', count: events.totalDocs, status: events.totalDocs > 0 ? 'online' : 'standby', color: 'var(--lcars-purple)' },
    ]
  } catch (err) {
    // If redirect was thrown, re-throw it
    if (err && typeof err === 'object' && 'digest' in err) throw err
    // Otherwise show defaults
  }

  return <BridgeConsole systems={systems} leoOnline={leoOnline} />
}
