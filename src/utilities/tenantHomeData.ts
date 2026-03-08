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
 * Directs users to interactive features: Dashboard, Learn, Shop, Events.
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
      // Block 1: Interactive navigation cards
      {
        blockType: 'content',
        columns: [
          {
            size: 'oneThird' as const,
            richText: createLexicalContent([
              createHeadingNode('Dashboard', 'h3'),
              createParagraphNode(
                'Your command centre — stats, activity feed, quick actions, and LEO at your side.',
              ),
            ]),
          },
          {
            size: 'oneThird' as const,
            richText: createLexicalContent([
              createHeadingNode('Learn', 'h3'),
              createParagraphNode(
                'Explore the Constitution, Federation, and LEO\'s full capabilities in the interactive Learn centre.',
              ),
            ]),
          },
          {
            size: 'oneThird' as const,
            richText: createLexicalContent([
              createHeadingNode('Discover', 'h3'),
              createParagraphNode(
                'Browse the Federation network — every Enterprise, every storefront, all connected.',
              ),
            ]),
          },
        ],
      },
      // Block 2: CTA — primary navigation
      {
        blockType: 'cta',
        richText: createLexicalContent([
          createHeadingNode('Get Started', 'h2'),
          createParagraphNode(
            `Explore ${siteName} — browse content, book appointments, shop products, or talk to LEO.`,
          ),
        ]),
        links: [
          {
            link: {
              type: 'custom' as const,
              label: 'Dashboard',
              url: '/dashboard',
              appearance: 'default',
            },
          },
          {
            link: {
              type: 'custom' as const,
              label: 'Learn',
              url: '/dashboard/learn',
              appearance: 'outline',
            },
          },
          {
            link: {
              type: 'custom' as const,
              label: 'Browse Posts',
              url: '/posts',
              appearance: 'outline',
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
      description: tagline || `Welcome to ${siteName} — powered by Angel OS`,
    },
  }
}
