/**
 * Dynamic Sitemap — /sitemap.xml
 *
 * Generates a sitemap for search engine indexing.
 * Includes static pages plus dynamic content (pages, posts, products).
 *
 * Referenced by robots.ts which declares sitemap location.
 *
 * @see src/app/[locale]/(app)/robots.ts — robots.txt with sitemap reference
 */
import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://spacesangels.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config: configPromise })

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  // Dynamic pages
  const pagesResult = await payload.find({
    collection: 'pages',
    where: { _status: { equals: 'published' } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    select: { slug: true, updatedAt: true },
  })

  const pages: MetadataRoute.Sitemap = pagesResult.docs
    .filter((doc: any) => doc.slug && doc.slug !== 'home')
    .map((doc: any) => ({
      url: `${baseUrl}/${doc.slug}`,
      lastModified: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  // Blog posts
  const postsResult = await payload.find({
    collection: 'posts',
    where: { _status: { equals: 'published' } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    select: { slug: true, updatedAt: true },
  })

  const posts: MetadataRoute.Sitemap = postsResult.docs
    .filter((doc: any) => doc.slug)
    .map((doc: any) => ({
      url: `${baseUrl}/posts/${doc.slug}`,
      lastModified: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

  // Products
  const productsResult = await payload.find({
    collection: 'products',
    where: { _status: { equals: 'published' } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    select: { slug: true, updatedAt: true },
  })

  const products: MetadataRoute.Sitemap = productsResult.docs
    .filter((doc: any) => doc.slug)
    .map((doc: any) => ({
      url: `${baseUrl}/products/${doc.slug}`,
      lastModified: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))

  return [...staticPages, ...pages, ...posts, ...products]
}
