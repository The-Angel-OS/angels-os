import type { Metadata } from 'next'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { RenderHero } from '@/heros/RenderHero'
import { CollectionHero } from '@/components/CollectionHero'
import { tenantHeroImage } from '@/utilities/tenantHeroImage'
import { generateMeta } from '@/utilities/generateMeta'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import { homeStaticData } from '@/endpoints/seed/home-static'
import { tenantHomeData } from '@/utilities/tenantHomeData'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import React from 'react'

import type { Page } from '@/payload-types'
import { notFound } from 'next/navigation'

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
    return notFound()
  }

  const { hero, layout } = page

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

  return (
    <article className="pt-16 pb-24">
      {homeSplash ?? <RenderHero {...hero} />}
      <RenderBlocks blocks={layout} />
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
