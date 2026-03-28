import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { cookies } from 'next/headers'
import { DonatePage } from './DonatePage'

export const metadata = {
  title: 'Donate',
  description:
    'Support Angel OS — 100% of donations go directly to housing, food, and infrastructure for the community building this platform.',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DonatePageRoute({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  // Resolve tenant from cookie
  const cookieStore = await cookies()
  const tenantSlug = cookieStore.get('payload-tenant')?.value || 'default'

  // Get tenant branding
  let tenantName = 'Angel OS'
  let donationsEnabled = true

  try {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const tenant = tenants.docs[0]
    if (tenant) {
      tenantName = (tenant as any).branding?.siteName || tenant.name || 'Angel OS'

      // Check SiteSettings for donationsEnabled
      const settings = await payload.find({
        collection: 'site-settings',
        where: { tenant: { equals: tenant.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (settings.docs[0] && (settings.docs[0] as any).donationsEnabled === false) {
        donationsEnabled = false
      }
    }
  } catch {
    // Fallback to defaults
  }

  return <DonatePage tenantName={tenantName} tenantSlug={tenantSlug} donationsEnabled={donationsEnabled} />
}
