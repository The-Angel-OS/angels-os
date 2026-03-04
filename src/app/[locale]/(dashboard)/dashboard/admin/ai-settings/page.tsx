import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { SettingsHub } from './SettingsHub'

export default async function DashboardSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  // Resolve tenant
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  let tenantId: number | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tenant: any = null

  if (tenantSlug) {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenant = tenants.docs?.[0]
    tenantId = tenant?.id
  }
  if (!tenantId) {
    const defaults = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'default' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenant = defaults.docs?.[0]
    tenantId = tenant?.id
  }

  const aiConfig = (tenant as any)?.aiConfig || {}
  const branding = (tenant as any)?.branding || {}
  const commerce = (tenant as any)?.commerce || {}

  return (
    <SettingsHub
      tenantId={tenantId || 0}
      hasAnthropicKey={Boolean(aiConfig.anthropicApiKey)}
      hasOpenRouterKey={Boolean(aiConfig.openrouterApiKey)}
      branding={{
        siteName: branding.siteName || '',
        tagline: branding.tagline || '',
        primaryColor: branding.primaryColor || '',
        secondaryColor: branding.secondaryColor || '',
        accentColor: branding.accentColor || '',
        backgroundColor: branding.backgroundColor || '',
        foregroundColor: branding.foregroundColor || '',
        borderColor: branding.borderColor || '',
        headingFont: branding.headingFont || 'inter',
        bodyFont: branding.bodyFont || 'inter',
      }}
      commerce={{
        currency: commerce.currency || 'usd',
        taxRate: commerce.taxRate ?? 0,
        shippingEnabled: commerce.shippingEnabled ?? false,
        bookingsEnabled: commerce.bookingsEnabled ?? false,
        eventsEnabled: commerce.eventsEnabled ?? false,
        digitalProductsEnabled: commerce.digitalProductsEnabled ?? false,
      }}
    />
  )
}
