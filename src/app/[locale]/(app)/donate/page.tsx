import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
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

  // Resolve the tenant from the request (subdomain → x-tenant-id), NOT a cookie.
  // The payload-tenant cookie is unreliable across subdomains (stale/absent), which
  // made every endeavor's /donate show the platform ("Support Angel OS") copy.
  const { tenant } = await resolveTenantFromHeaders()
  const tenantSlug = (tenant as any)?.slug || 'default'
  const tenantName = (tenant as any)?.branding?.siteName || (tenant as any)?.name || 'Angel OS'
  const isPlatform = !tenant || (tenant as any).type === 'platform'

  // Funds route to THIS endeavor only when it's a non-platform, Connect-enabled tenant.
  const connect = (tenant as any)?.stripeConnect
  const isEndeavorDonation = Boolean(
    !isPlatform && connect?.stripeAccountId && connect?.stripeChargesEnabled,
  )

  // Check SiteSettings for donationsEnabled (non-critical)
  let donationsEnabled = true
  try {
    if (tenant?.id) {
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

  return (
    <DonatePage
      tenantName={tenantName}
      tenantSlug={tenantSlug}
      donationsEnabled={donationsEnabled}
      isEndeavorDonation={isEndeavorDonation}
      isPlatform={isPlatform}
    />
  )
}
