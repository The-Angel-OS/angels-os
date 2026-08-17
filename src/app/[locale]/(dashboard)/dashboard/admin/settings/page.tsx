import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { SettingsHub } from './SettingsHub'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

export default async function DashboardSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })

  // Resolve tenant (cached, React.cache deduped)
  const { tenant, tenantId } = await resolveTenantFromHeaders()

  const aiConfig = tenant?.aiConfig || {}
  const branding = tenant?.branding || {}
  const commerce = tenant?.commerce || {}
  const storefront = tenant?.storefront || {}

  return (
    <SettingsHub
      tenantId={tenantId || 0}
      hasAnthropicKey={Boolean(aiConfig.anthropicApiKey)}
      hasOpenRouterKey={Boolean(aiConfig.openrouterApiKey)}
      branding={{
        // depth-2 tenant fetch hydrates branding.logo to an object
        logo:
          branding.logo && typeof branding.logo === 'object' && branding.logo.url
            ? { id: branding.logo.id, url: branding.logo.url }
            : null,
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
      addresses={(() => {
        const aliases = (
          (tenant?.domains as { domain?: string; isPrimary?: boolean }[] | undefined) || []
        )
          .filter((d) => Boolean(d?.domain))
          .map((d) => ({ domain: d.domain as string, isPrimary: Boolean(d.isPrimary) }))
        return {
          slug: tenant?.slug || '',
          domain: tenant?.domain || '',
          aliases,
          // Same precedence the outbound-URL builder uses: a primary alias wins,
          // otherwise the tenant's own `domain` field.
          canonical: aliases.find((a) => a.isPrimary)?.domain || tenant?.domain || '',
        }
      })()}
      storefront={{
        // Same depth-2 hydration as branding.logo above.
        coverImage:
          storefront.coverImage &&
          typeof storefront.coverImage === 'object' &&
          storefront.coverImage.url
            ? { id: storefront.coverImage.id, url: storefront.coverImage.url }
            : null,
      }}
    />
  )
}
