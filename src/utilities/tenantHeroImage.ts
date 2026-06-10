/**
 * Resolve the tenant's hero/cover image URL for a collection list page.
 *
 * Portals can set a single storefront cover image (storefront.coverImage) that
 * Shop, Posts, Events, and About inherit so the listings match the home page.
 * Optionally, a portal can override the hero PER SECTION
 * (storefront.postsHeroImage / eventsHeroImage / shopHeroImage); when a section
 * override is set it wins, otherwise we fall back to the shared coverImage, and
 * finally to null so CollectionHero shows the brand gradient.
 *
 * The per-section fields are read defensively — if they don't exist on the
 * tenant doc yet (pre-migration), resolution simply falls through to coverImage,
 * so this utility is safe to ship before the schema fields land.
 */
export type HeroSection = 'posts' | 'events' | 'shop'

const SECTION_FIELD: Record<HeroSection, string> = {
  posts: 'postsHeroImage',
  events: 'eventsHeroImage',
  shop: 'shopHeroImage',
}

/** Pull a `.url` string off an upload field value, if present. */
function uploadUrl(value: unknown): string | null {
  if (value && typeof value === 'object' && typeof (value as { url?: unknown }).url === 'string') {
    return (value as { url: string }).url
  }
  return null
}

export function tenantHeroImage(tenant: unknown, section?: HeroSection): string | null {
  if (!tenant || typeof tenant !== 'object') return null
  const storefront = (tenant as { storefront?: unknown }).storefront
  if (!storefront || typeof storefront !== 'object') return null

  // Per-section override wins when requested and set.
  if (section) {
    const sectionUrl = uploadUrl((storefront as Record<string, unknown>)[SECTION_FIELD[section]])
    if (sectionUrl) return sectionUrl
  }

  // Fall back to the shared storefront cover image.
  return uploadUrl((storefront as { coverImage?: unknown }).coverImage)
}
