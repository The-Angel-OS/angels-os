import type { RequiredDataFromCollectionSlug } from 'payload'
import type { Tenant } from '@/payload-types'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
} from '@/utilities/lexicalHelpers'

/**
 * Tenant-branded home page fallback.
 *
 * When a tenant doesn't have a CMS-managed 'home' page, this generates
 * a branded landing page using the tenant's branding data (siteName, tagline).
 * Replaces the generic Angel OS homeStaticData() for tenant subdomains.
 */
export function tenantHomeData(tenant: Tenant): RequiredDataFromCollectionSlug<'pages'> {
  const siteName = tenant.branding?.siteName || tenant.name || 'Welcome'
  const tagline =
    typeof tenant.branding?.tagline === 'string' ? tenant.branding.tagline : ''

  return {
    slug: 'home',
    _status: 'published',
    title: 'Home',
    hero: {
      type: 'lowImpact',
      richText: createLexicalContent([
        createHeadingNode(siteName, 'h1'),
        ...(tagline ? [createParagraphNode(tagline)] : []),
      ]),
    },
    layout: [
      {
        blockType: 'content',
        columns: [
          {
            size: 'full' as const,
            richText: createLexicalContent([
              createParagraphNode(
                `Welcome to ${siteName}. Explore our latest posts, upcoming events, products, and community spaces.`,
              ),
            ]),
          },
        ],
      },
      {
        blockType: 'cta',
        richText: createLexicalContent([
          createHeadingNode('Get Started', 'h2'),
          createParagraphNode(
            'Browse our content or sign in to access your dashboard and collaboration spaces.',
          ),
        ]),
        links: [
          {
            link: {
              type: 'custom' as const,
              label: 'Browse Posts',
              url: '/posts',
              appearance: 'default',
            },
          },
          {
            link: {
              type: 'custom' as const,
              label: 'View Events',
              url: '/events',
              appearance: 'outline',
            },
          },
        ],
      },
    ],
    meta: {
      title: `${siteName}${tagline ? ' — ' + tagline : ''}`,
      description: tagline || `Welcome to ${siteName}`,
    },
  }
}
