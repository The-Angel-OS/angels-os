import type { Metadata } from 'next'
import { headers } from 'next/headers'

import type { Media, Page, Post, Config } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { getServerSideURL } from './getURL'
import { resolveTenantFromHeaders } from './resolveTenantFromHeaders'
import { tenantHeroImage } from './tenantHeroImage'

/** Prefix a site-relative URL with the request origin so unfurlers can fetch it. */
const absolute = (url: string, origin: string) => (url.startsWith('http') ? url : origin + url)

interface RequestBranding {
  /** This portal's display name (branding.siteName → tenant name → 'Angel OS'). */
  siteName: string
  /** The origin the visitor is actually on (subdomain-aware), for absolute og:url/og:image. */
  origin: string
  /** The portal's storefront cover image, if set — the config-free unfurl image. */
  tenantImage: string | null
}

/**
 * Resolve the CURRENT portal's branding for social meta. Unfurls must carry the
 * portal's own name, origin, and imagery — not the platform's — so a link to
 * grace-chapel.spacesangels.com/donate previews as Grace Chapel. Fail-soft to
 * platform branding outside a request context (build time, workers).
 */
async function resolveRequestBranding(): Promise<RequestBranding> {
  let siteName = 'Angel OS'
  let origin = getServerSideURL()
  let tenantImage: string | null = null
  try {
    const h = await headers()
    const host = h.get('x-forwarded-host') || h.get('host')
    const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
    if (host) origin = `${proto}://${host}`
    const { tenant } = await resolveTenantFromHeaders()
    const t = tenant as { name?: string; branding?: { siteName?: string } } | null
    siteName = t?.branding?.siteName || t?.name || siteName
    tenantImage = tenantHeroImage(tenant)
  } catch {
    /* non-request context — platform defaults */
  }
  return { siteName, origin, tenantImage }
}

const getImageURL = (
  image: Media | Config['db']['defaultIDType'] | null | undefined,
  branding: RequestBranding,
) => {
  // Page meta image wins; else the portal's cover image; else the template mark.
  if (image && typeof image === 'object' && 'url' in image && image.url) {
    return absolute(image.url, branding.origin)
  }
  if (branding.tenantImage) return absolute(branding.tenantImage, branding.origin)
  return `${branding.origin}/website-template-OG.webp`
}

export const generateMeta = async (args: {
  doc: Partial<Page> | Partial<Post> | null
}): Promise<Metadata> => {
  const { doc } = args
  const branding = await resolveRequestBranding()

  const ogImage = getImageURL(doc?.meta?.image, branding)

  // meta.title → doc title → bare portal name. Suffix with the PORTAL's name so
  // a shared link is attributed to the endeavor, not the platform.
  const baseTitle = doc?.meta?.title || (doc as { title?: string } | null)?.title
  const title = baseTitle ? `${baseTitle} | ${branding.siteName}` : branding.siteName

  const slug = Array.isArray(doc?.slug) ? doc?.slug.join('/') : doc?.slug || ''
  const path = slug && slug !== 'home' ? `/${slug}` : '/'

  return {
    description: doc?.meta?.description,
    openGraph: mergeOpenGraph({
      description: doc?.meta?.description || '',
      images: [{ url: ogImage }],
      title,
      url: `${branding.origin}${path}`,
      siteName: branding.siteName,
    }),
    title,
  }
}

/**
 * Tenant-branded metadata for the SPECIAL routes (/donate, /book, /spaces, …)
 * that render built-in surfaces rather than a CMS Page. Gives every portal a
 * complete unfurl (og:title/description/image/url) with zero configuration:
 * the portal's siteName + storefront cover image carry the preview. Routes
 * that support a CMS Page override should prefer generateMeta({doc}) when the
 * authored page exists and fall back to this.
 */
export const generateTenantRouteMeta = async (args: {
  title: string
  description?: string
  path: string
}): Promise<Metadata> => {
  const branding = await resolveRequestBranding()
  const title = `${args.title} | ${branding.siteName}`
  return {
    title,
    description: args.description,
    openGraph: mergeOpenGraph({
      title,
      description: args.description || '',
      images: [{ url: getImageURL(null, branding) }],
      url: `${branding.origin}${args.path}`,
      siteName: branding.siteName,
    }),
  }
}
