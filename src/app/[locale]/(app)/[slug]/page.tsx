import type { Metadata } from 'next'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { AlreadyOnboardedBanner } from '@/components/AlreadyOnboardedBanner'
import { RenderHero } from '@/heros/RenderHero'
import { CollectionHero } from '@/components/CollectionHero'
import { tenantHeroImage } from '@/utilities/tenantHeroImage'
import { generateMeta } from '@/utilities/generateMeta'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode, headers } from 'next/headers'
import { canViewPage } from '@/utilities/pageAccess'
import { MembersOnlyGate } from '@/components/MembersOnlyGate'
import { homeStaticData } from '@/endpoints/seed/home-static'
import { tenantHomeData } from '@/utilities/tenantHomeData'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import React from 'react'

import type { Page } from '@/payload-types'
import { notFound, redirect } from 'next/navigation'

// NOTE: generateStaticParams removed — this page uses headers() + draftMode()
// which makes it dynamic. SSG conflicts with dynamic functions and causes 500s.

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Page({ params }: Args) {
  const { slug = 'home' } = await params
  const url = '/' + slug

  let page = await queryPageBySlug({
    slug,
  })

  // Fallback home page: tenant-branded if tenant is resolved, else generic Angel OS
  if (!page && slug === 'home') {
    const { tenant } = await resolveTenantFromHeaders()
    if (tenant) {
      page = tenantHomeData(tenant) as Page
    }
    if (!page) {
      page = homeStaticData() as Page
    }
  }

  if (!page) {
    // Migrated-site safety net: an old-site URL that no longer exists may have a
    // tenant-configured redirect (seeded from the old sitemap). Check before 404ing.
    const { tenant, tenantId } = await resolveTenantFromHeaders()
    void tenant
    const { getPayload } = await import('payload')
    const { resolveRedirect } = await import('@/utilities/resolveRedirect')
    const config = (await import('@payload-config')).default
    const target = await resolveRedirect(await getPayload({ config }), tenantId, url)
    if (target) redirect(target)
    return notFound()
  }

  const { hero, layout, id: pageId } = page

  // Consistent home-page hero across every endeavor: use the page's own hero
  // image when set; otherwise fall back to the branded CollectionHero (tenant
  // cover image if present, else the brand gradient) so portals like HelpDNA and
  // Hays Cactus get the same polished treatment instead of a bare text hero.
  const heroHasMedia = Boolean(
    hero && typeof (hero as { media?: unknown }).media === 'object' && (hero as { media?: { url?: string } }).media?.url,
  )

  let homeSplash: React.ReactNode = null
  if (slug === 'home' && !heroHasMedia) {
    const { tenant } = await resolveTenantFromHeaders()
    const branding = (tenant as { branding?: { siteName?: string; tagline?: unknown } } | null)?.branding
    const siteName = branding?.siteName || (tenant as { name?: string } | null)?.name || 'Angel OS'
    const tagline = typeof branding?.tagline === 'string' ? branding.tagline : undefined
    homeSplash = (
      <div className="container">
        <CollectionHero title={siteName} subtitle={tagline} image={tenantHeroImage(tenant)} />
      </div>
    )
  }

  // The page's endeavor/tenant slug — default for context-aware blocks (Merlin Control)
  // so a Merlin lists its OWN endeavor's nodes without the editor retyping the slug.
  const { tenant: pageTenant } = await resolveTenantFromHeaders()
  const tenantSlug = (pageTenant as { slug?: string } | null)?.slug
  const tenantId = (pageTenant as { id?: string | number } | null)?.id

  // Membership gate: if the page declares a non-public `access` level, show a join
  // prompt instead of the content for ineligible viewers (admins always pass).
  const access = (page as { access?: string }).access
  if (access && access !== 'public') {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: await headers() })
    if (!(await canViewPage(payload, access, user, tenantId))) {
      return <MembersOnlyGate access={access} isAuthenticated={Boolean(user)} path={url} />
    }
  }

  // A full-bleed hero IS the top of the page — it wants the header's edge, not
  // 64px of white above it. That padding is there for pages that open on text,
  // where copy running into the nav would read as broken. Deciding by what the
  // page actually opens with means neither case needs a setting.
  // Every hero that paints its own full-bleed background. splitPanel belongs
  // here and was the one I missed — it's what Kessela's home page actually uses,
  // so the fix shipped without changing the page it was written for.
  // mediumImpact is NOT here: it opens with a `container` text block, and copy
  // running into the nav is exactly what the padding exists to prevent.
  const BLEED_HEROES = new Set(['fullScreen', 'highImpact', 'splitPanel'])
  const bleedsToTop =
    Boolean(homeSplash) || BLEED_HEROES.has((hero as { type?: string } | undefined)?.type ?? '')

  return (
    <article className={bleedsToTop ? 'pb-24' : 'pt-16 pb-24'}>
      {homeSplash ?? <RenderHero {...hero} />}
      {/* Above the pitch, not below it — a customer should not have to read
          the sales page to find the door back into their own portal. */}
      <AlreadyOnboardedBanner tenantSlug={tenantSlug} />
      <RenderBlocks blocks={layout} tenantSlug={tenantSlug} docContext={{ id: pageId, collection: 'pages' }} />
    </article>
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug = 'home' } = await params

  const page = await queryPageBySlug({
    slug,
  })

  return generateMeta({ doc: page })
}

const queryPageBySlug = async ({ slug }: { slug: string }) => {
  try {
    const { isEnabled: draft } = await draftMode()
    const { tenantFilter } = await resolveTenantFromHeaders()
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'pages',
      draft,
      limit: 1,
      overrideAccess: true, // Public pages must be readable without auth
      pagination: false,
      where: {
        and: [
          { slug: { equals: slug } },
          ...(draft ? [] : [{ _status: { equals: 'published' } }]),
          tenantFilter,
        ],
      },
    })

    return result.docs?.[0] || null
  } catch (err) {
    console.error('[queryPageBySlug] Query failed — falling back to static data:', err)
    return null
  }
}
