/**
 * structuredData — the JSON-LD every tenant site emits.
 *
 * Until now the only structured data on the platform was a Product graph on
 * /products/[slug] and an FAQPage inside one block. Everything else — the
 * organisation itself, its opening hours, its articles, its events — was
 * invisible to the machines that decide whether a church shows up in the map
 * pack or an event shows up in the Google events carousel. That is the single
 * highest-return SEO gap on a platform whose lead vertical is local businesses
 * and congregations.
 *
 * These are plain builders: tenant/post/event in, a JSON-LD object out. No
 * dependency, no schema registry, no validation layer — schema.org is a shape,
 * not an API, and the search engines ignore what they do not recognise.
 *
 * Two rules the callers rely on:
 *   1. Every builder returns `null` when it has nothing worth saying. Emitting
 *      an Organization with only a name is worse than emitting none — it is a
 *      thin-content signal, and it is why each builder counts what it actually
 *      has before it returns.
 *   2. Absolute URLs only. Relative `url`/`image` values are silently dropped by
 *      every consumer, so `abs()` is applied at the boundary rather than trusted
 *      to the caller.
 *
 * ponytail: hand-built objects, no schema-dts types. The compile-time safety
 * would cost a dependency and a lot of casting to buy correctness that only
 * Google's Rich Results Test can actually confirm. Add types if these ever grow
 * past a page of code.
 *
 * @see src/components/JsonLd.tsx — the component that renders these
 * @see tests/unit/structuredData.test.ts
 */

/** A JSON-LD node. Deliberately loose — see the ponytail note above. */
export type JsonLdObject = Record<string, unknown>

/** Resolve a possibly-relative URL against the site origin. Undefined stays undefined. */
export function abs(origin: string, url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url
  return `${origin.replace(/\/+$/, '')}/${String(url).replace(/^\/+/, '')}`
}

/** Drop undefined/null/empty values so the emitted graph carries no dead keys. */
function compact<T extends JsonLdObject>(obj: T): T {
  const out: JsonLdObject = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'string' && v.trim() === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return out as T
}

/**
 * `businessType` on a Tenant → the schema.org type that describes it.
 *
 * A more specific type is what earns the richer result: `Church` gets a place
 * card with service times, `Organization` gets a name and a logo. Anything we
 * cannot map confidently falls back to LocalBusiness (when there is a physical
 * presence) or Organization, both of which are always valid.
 */
export function schemaTypeFor(businessType: string | null | undefined, hasPlace: boolean): string {
  const map: Record<string, string> = {
    church: 'Church',
    religious: 'Church',
    nonprofit: 'NGO',
    charity: 'NGO',
    education: 'EducationalOrganization',
    school: 'EducationalOrganization',
    restaurant: 'Restaurant',
    retail: 'Store',
    ecommerce: 'OnlineStore',
    salon: 'HealthAndBeautyBusiness',
    fitness: 'ExerciseGym',
    gym: 'ExerciseGym',
    medical: 'MedicalBusiness',
    legal: 'LegalService',
    realestate: 'RealEstateAgent',
    'real-estate': 'RealEstateAgent',
    automotive: 'AutomotiveBusiness',
    services: 'ProfessionalService',
    professional: 'ProfessionalService',
  }
  const key = String(businessType || '').toLowerCase()
  return map[key] || (hasPlace ? 'LocalBusiness' : 'Organization')
}

const DAY_URI: Record<string, string> = {
  monday: 'https://schema.org/Monday',
  tuesday: 'https://schema.org/Tuesday',
  wednesday: 'https://schema.org/Wednesday',
  thursday: 'https://schema.org/Thursday',
  friday: 'https://schema.org/Friday',
  saturday: 'https://schema.org/Saturday',
  sunday: 'https://schema.org/Sunday',
}

export interface OpeningHour {
  day?: string | null
  open?: string | null
  close?: string | null
}

/** businessHours rows → OpeningHoursSpecification. Rows missing any part are skipped. */
export function openingHours(rows: OpeningHour[] | null | undefined): JsonLdObject[] {
  return (rows || [])
    .map((r) => {
      const day = DAY_URI[String(r?.day || '').toLowerCase()]
      if (!day || !r?.open || !r?.close) return null
      return {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: day,
        opens: r.open,
        closes: r.close,
      }
    })
    .filter(Boolean) as JsonLdObject[]
}

export interface TenantLike {
  name?: string | null
  branding?: { siteName?: string | null; tagline?: string | null; logo?: unknown } | null
  businessType?: string | null
  storefront?: {
    description?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    coverImage?: unknown
    socialLinks?: Array<{ platform?: string | null; url?: string | null }> | null
    businessHours?: OpeningHour[] | null
    address?: {
      street?: string | null
      city?: string | null
      region?: string | null
      postalCode?: string | null
      country?: string | null
    } | null
  } | null
}

/** A media relation is either a populated doc or a bare id. Only the doc has a url. */
function mediaUrl(m: unknown): string | undefined {
  if (m && typeof m === 'object' && typeof (m as { url?: unknown }).url === 'string') {
    return (m as { url: string }).url
  }
  return undefined
}

/**
 * The site's identity node — Organization, or the most specific subtype we can
 * justify. `@id` is stable (`<origin>/#organization`) so every other node on the
 * site points at it by reference instead of repeating it.
 */
export function organizationJsonLd(
  tenant: TenantLike | null | undefined,
  origin: string,
): JsonLdObject | null {
  if (!tenant) return null
  const name = tenant.branding?.siteName || tenant.name
  if (!name) return null

  const sf = tenant.storefront || {}
  const a = sf.address || {}
  // A postal address is only worth emitting if it could actually be found. A
  // lone country is not an address, and a LocalBusiness whose address is "US"
  // is a worse signal than one with no address at all.
  const hasAddress = Boolean(a.street && a.city)
  const address = hasAddress
    ? compact({
        '@type': 'PostalAddress',
        streetAddress: a.street,
        addressLocality: a.city,
        addressRegion: a.region,
        postalCode: a.postalCode,
        addressCountry: a.country || 'US',
      })
    : undefined

  const hasPlace = hasAddress || Boolean(sf.contactPhone)
  const hours = openingHours(sf.businessHours)

  return compact({
    '@context': 'https://schema.org',
    '@type': schemaTypeFor(tenant.businessType, hasPlace),
    '@id': `${origin}/#organization`,
    name,
    url: origin,
    description: sf.description || tenant.branding?.tagline || undefined,
    logo: abs(origin, mediaUrl(tenant.branding?.logo)),
    image: abs(origin, mediaUrl(sf.coverImage) || mediaUrl(tenant.branding?.logo)),
    email: sf.contactEmail || undefined,
    telephone: sf.contactPhone || undefined,
    address,
    openingHoursSpecification: hours,
    sameAs: (sf.socialLinks || [])
      .map((s) => s?.url)
      .filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u)),
  })
}

/**
 * WebSite node. Its real job is the sitelinks search box — hence the
 * SearchAction — plus giving articles a publisher to point at.
 */
export function websiteJsonLd(
  tenant: TenantLike | null | undefined,
  origin: string,
  opts: { searchPath?: string } = {},
): JsonLdObject | null {
  const name = tenant?.branding?.siteName || tenant?.name
  if (!name) return null
  return compact({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name,
    url: origin,
    publisher: { '@id': `${origin}/#organization` },
    // Only claimed when the site actually has a search route to honour it.
    // Declaring a SearchAction that 404s is a broken promise Google will test.
    potentialAction: opts.searchPath
      ? {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${origin}${opts.searchPath}?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        }
      : undefined,
  })
}

export interface PostLike {
  title?: string | null
  slug?: string | null
  publishedOn?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  meta?: { description?: string | null; image?: unknown } | null
  hero?: { media?: unknown } | null
  populatedAuthors?: Array<{ name?: string | null }> | null
}

/** An Article node for a single post. */
export function articleJsonLd(
  post: PostLike | null | undefined,
  origin: string,
  pathname: string,
): JsonLdObject | null {
  if (!post?.title) return null
  const image = abs(origin, mediaUrl(post.meta?.image) || mediaUrl(post.hero?.media))
  const authors = (post.populatedAuthors || [])
    .map((a) => a?.name)
    .filter((n): n is string => Boolean(n))
    .map((n) => ({ '@type': 'Person', name: n }))

  return compact({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: String(post.title).slice(0, 110), // Google truncates past ~110 chars
    description: post.meta?.description || undefined,
    image,
    datePublished: post.publishedOn || post.createdAt || undefined,
    dateModified: post.updatedAt || post.publishedOn || post.createdAt || undefined,
    author: authors.length ? authors : { '@id': `${origin}/#organization` },
    publisher: { '@id': `${origin}/#organization` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${origin}${pathname}` },
  })
}

export interface EventLike {
  title?: string | null
  description?: string | null
  startDateTime?: string | null
  endDateTime?: string | null
  status?: string | null
  coverImage?: unknown
  location?: {
    type?: string | null
    venueName?: string | null
    address?: string | null
    remoteLink?: string | null
  } | null
  pricing?: { isFree?: boolean | null; amount?: number | null; currency?: string | null } | null
  registration?: { isOpen?: boolean | null } | null
}

/**
 * An Event node. Google's events carousel requires name + startDate + location,
 * so anything missing a start date returns null rather than an invalid graph.
 */
export function eventJsonLd(
  event: EventLike | null | undefined,
  origin: string,
  pathname: string,
): JsonLdObject | null {
  if (!event?.title || !event.startDateTime) return null

  const loc = event.location || {}
  const isOnline = loc.type === 'online' || loc.type === 'remote' || loc.type === 'virtual'
  const isHybrid = loc.type === 'hybrid'
  // location is REQUIRED. A physical event with neither venue nor address still
  // has one honest answer — the organisation itself — which beats omitting the
  // property and failing validation outright.
  const location = isOnline
    ? { '@type': 'VirtualLocation', url: loc.remoteLink || `${origin}${pathname}` }
    : loc.venueName || loc.address
      ? compact({
          '@type': 'Place',
          name: loc.venueName || undefined,
          address: loc.address || undefined,
        })
      : { '@id': `${origin}/#organization` }

  const price = event.pricing?.isFree ? 0 : event.pricing?.amount
  const offers =
    price === undefined || price === null
      ? undefined
      : compact({
          '@type': 'Offer',
          price: String(price),
          priceCurrency: String(event.pricing?.currency || 'USD').toUpperCase(),
          url: `${origin}${pathname}`,
          availability:
            event.registration?.isOpen === false
              ? 'https://schema.org/SoldOut'
              : 'https://schema.org/InStock',
        })

  return compact({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description || undefined,
    startDate: event.startDateTime,
    endDate: event.endDateTime || undefined,
    eventStatus:
      event.status === 'cancelled'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    eventAttendanceMode: isOnline
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : isHybrid
        ? 'https://schema.org/MixedEventAttendanceMode'
        : 'https://schema.org/OfflineEventAttendanceMode',
    image: abs(origin, mediaUrl(event.coverImage)),
    location,
    offers,
    organizer: { '@id': `${origin}/#organization` },
    url: `${origin}${pathname}`,
  })
}

/** BreadcrumbList from crumbs, in order, root first. */
export function breadcrumbJsonLd(
  origin: string,
  crumbs: Array<{ name: string; path: string }>,
): JsonLdObject | null {
  if (crumbs.length < 2) return null // a one-item trail is not a trail
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${origin}${c.path}`,
    })),
  }
}
