import type { Payload, PayloadRequest } from 'payload'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
} from '@/utilities/lexicalHelpers'

/**
 * Creates default CMS pages (home, contact) for a newly provisioned tenant.
 *
 * Without these pages the admin panel shows "No Results" for the Pages
 * collection, even though the frontend falls back to tenantHomeData().
 * Having actual CMS pages lets tenant admins edit their content.
 *
 * Idempotent: skips creation if pages with the same slug already exist
 * for the given tenant.
 */
export async function createDefaultTenantPages(
  payload: Payload,
  tenantId: number | string,
  opts: { siteName: string; tagline?: string },
  req?: PayloadRequest,
): Promise<void> {
  // See createDefaultTenantNavigation: pass `req` so these inserts join the
  // tenant-create transaction instead of deadlocking on its uncommitted FK.
  const tx = req ? { req } : {}
  const { siteName, tagline = '' } = opts

  // Check for existing home page to ensure idempotency
  const existingHome = await payload.find({
    collection: 'pages',
    where: {
      and: [{ slug: { equals: 'home' } }, { tenant: { equals: tenantId } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    ...tx,
  })

  if (existingHome.docs.length > 0) {
    return // Pages already exist for this tenant
  }

  // Create home page
  await payload.create({
    collection: 'pages',
    depth: 0,
    overrideAccess: true,
    ...tx,
    data: {
      slug: 'home',
      title: 'Home',
      _status: 'published',
      tenant: tenantId,
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
    } as any,
  })

  // Create contact page
  await payload.create({
    collection: 'pages',
    depth: 0,
    overrideAccess: true,
    ...tx,
    data: {
      slug: 'contact',
      title: 'Contact',
      _status: 'published',
      tenant: tenantId,
      hero: {
        type: 'lowImpact',
        richText: createLexicalContent([
          createHeadingNode('Contact Us', 'h1'),
          createParagraphNode(`Get in touch with ${siteName}. We'd love to hear from you.`),
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
                  `Have questions or want to learn more about ${siteName}? Reach out to us and we'll get back to you as soon as possible.`,
                ),
              ]),
            },
          ],
        },
      ],
      meta: {
        title: `Contact — ${siteName}`,
        description: `Get in touch with ${siteName}`,
      },
    } as any,
  })
}
