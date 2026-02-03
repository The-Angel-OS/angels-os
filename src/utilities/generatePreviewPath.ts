import { PayloadRequest, CollectionSlug } from 'payload'

const collectionPrefixMap: Partial<Record<CollectionSlug, string>> = {
  products: '/products',
  pages: '',
  posts: '/posts',
}

// Default locale for next-intl (must match i18n/routing.ts)
const DEFAULT_LOCALE = 'en'

type Props = {
  collection: keyof typeof collectionPrefixMap
  slug?: string | null
  req?: PayloadRequest
}

export const generatePreviewPath = ({ collection, slug }: Props) => {
  // Allow empty strings, e.g. for the homepage
  if (slug === undefined || slug === null) {
    return null
  }

  // Path must include locale for [locale] route (e.g. /en/contact)
  const basePath = collectionPrefixMap[collection]
    ? `${collectionPrefixMap[collection]}/${slug}`.replace(/^\/+/, '/')
    : slug === 'home'
      ? ''
      : `/${slug}`

  const path = basePath ? `/${DEFAULT_LOCALE}${basePath}` : `/${DEFAULT_LOCALE}`

  const encodedParams = new URLSearchParams({
    slug,
    collection,
    path,
    previewSecret: process.env.PREVIEW_SECRET || '',
  })

  const url = `/${DEFAULT_LOCALE}/next/preview?${encodedParams.toString()}`

  return url
}
