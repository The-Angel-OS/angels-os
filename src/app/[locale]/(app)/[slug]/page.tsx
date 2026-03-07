import type { Metadata } from 'next'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { RenderHero } from '@/heros/RenderHero'
import { generateMeta } from '@/utilities/generateMeta'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode, headers } from 'next/headers'
import { homeStaticData } from '@/endpoints/seed/home-static'
import { tenantHomeData } from '@/utilities/tenantHomeData'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'
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
    const headersList = await headers()
    const tenantSlug = headersList.get('x-tenant-id')
    if (tenantSlug) {
      const tenant = await fetchTenantBySlug(tenantSlug)
      if (tenant) {
        page = tenantHomeData(tenant) as Page
      }
    }
    if (!page) {
      page = homeStaticData() as Page
    }
  }

  if (!page) {
    return notFound()
  }

  const { hero, layout } = page

  return (
    <article className="pt-16 pb-24">
      <RenderHero {...hero} />
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
