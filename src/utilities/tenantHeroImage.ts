/**
 * Resolve the tenant's hero/cover image URL (branding.coverImage), if set.
 *
 * Used to let collection list pages (Shop, Posts, Events, About, …) inherit the
 * portal's hero image so they visually match the home page. Returns null when no
 * cover image is configured, so the CollectionHero falls back to the brand
 * gradient. Zero schema change — branding.coverImage already exists.
 */
export function tenantHeroImage(tenant: unknown): string | null {
  if (!tenant || typeof tenant !== 'object') return null
  const branding = (tenant as { branding?: unknown }).branding
  if (!branding || typeof branding !== 'object') return null
  const cover = (branding as { coverImage?: unknown }).coverImage
  if (cover && typeof cover === 'object' && typeof (cover as { url?: unknown }).url === 'string') {
    return (cover as { url: string }).url
  }
  return null
}
