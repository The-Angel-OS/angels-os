import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { queryPageBySlug } from '@/utilities/queryPageBySlug'
import { RenderBlocks } from '@/blocks/RenderBlocks'
import { RenderHero } from '@/heros/RenderHero'
import { generateMeta, generateTenantRouteMeta } from '@/utilities/generateMeta'
import { DonationBlock } from '@/blocks/Donation/Component'

// Unfurl-complete metadata: the authored CMS Page's meta (title/description/
// image) when one exists for this tenant, else a tenant-branded default — so a
// shared /donate link previews as THIS portal on every messenger.
export async function generateMetadata(): Promise<Metadata> {
  const cmsPage = await queryPageBySlug({ slug: 'donate' })
  if (cmsPage) return generateMeta({ doc: cmsPage })
  return generateTenantRouteMeta({
    title: 'Donate',
    description:
      'Support this mission — your gift goes to the endeavor, less a small platform fee that keeps the site running.',
    path: '/donate',
  })
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

  // CMS-managed override: if an admin has authored a `donate` Page in the Pages
  // collection (e.g. a Donation block + Content), render that — fully editable.
  // Falls through to the built-in donation page below when no such Page exists.
  const cmsPage = await queryPageBySlug({ slug: 'donate' })
  if (cmsPage) {
    return (
      <article className="pt-16 pb-24">
        <RenderHero {...(cmsPage.hero as any)} />
        <RenderBlocks blocks={cmsPage.layout} />
      </article>
    )
  }

  const payload = await getPayload({ config: configPromise })

  // Resolve the tenant from the request (subdomain → x-tenant-id), NOT a cookie.
  // The payload-tenant cookie is unreliable across subdomains (stale/absent), which
  // made every endeavor's /donate show the platform ("Support Angel OS") copy.
  const { tenant } = await resolveTenantFromHeaders()
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

  if (!donationsEnabled) {
    return (
      <div className="container mx-auto max-w-lg py-20 text-center">
        <h1 className="mb-4 text-3xl font-bold">Donations</h1>
        <p className="opacity-70">
          Donations are not currently accepted for {tenantName}. Please check back later.
        </p>
      </div>
    )
  }

  // Built-in fallback = the SAME DonationBlock the CMS override uses (one form
  // implementation, no drift). Authoring a `donate` Page simply replaces this
  // shell with editable hero/copy around that same block.
  return (
    <article className="pt-16 pb-24">
      <div className="container mb-10 max-w-2xl">
        <h1 className="mb-3 text-4xl font-bold">Support {tenantName}</h1>
        <p className="text-lg opacity-80">
          {/* A donor should be able to tell where their money goes without
              learning a house vocabulary first. "Platform fee" is what it is. */}
          {isEndeavorDonation
            ? `95% of your gift goes straight to ${tenantName}. The remaining 5% is the platform fee that keeps the site running. Handled securely by Stripe, and every gift is on the record.`
            : isPlatform
              ? 'Your gift keeps the lights on and the servers running for every endeavor on this platform.'
              : `Your gift supports ${tenantName}. It is held by the platform until this endeavor connects its own payment account, then passed straight on.`}
        </p>
      </div>
      <DonationBlock presetAmounts="10,25,50,100,500" showDonorFields />
    </article>
  )
}
