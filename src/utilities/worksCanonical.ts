/**
 * Works canonical-URL resolution — the heart of publish-once-canonical.
 *
 * A Work is canonical at its publishing endeavor's root. When a Work declares a
 * canonical origin, the reader emits rel=canonical THERE even when served from a
 * subscriber's domain — so spiders/SEO and authority flow home to the publisher,
 * with no duplicate-content penalty. When a Work declares nothing, it falls back
 * to self-canonical at the serving origin (legacy behavior preserved).
 *
 * Pure + framework-free so it's trivially testable and reusable by every reader
 * surface (markdown soul viewer, book reader, soul index).
 */

export interface CanonicalDecl {
  origin?: string
  endeavor?: string
}

/** Strip trailing slashes so we never emit `https://host//learn/...`. */
function trimTrailingSlash(s: string): string {
  return s.replace(/\/+$/, '')
}

/**
 * The origin a Work's canonical URLs should live under: the declared publisher
 * origin when present, else the serving origin (self-canonical fallback).
 */
export function resolveCanonicalOrigin(
  canonical: CanonicalDecl | undefined,
  servingOrigin: string,
): string {
  const declared = canonical?.origin?.trim()
  if (declared) return trimTrailingSlash(declared)
  return trimTrailingSlash(servingOrigin || '')
}

/**
 * Full canonical URL for a Work page: `<publisher-origin>/learn/<soulId>/<pageSlug>`.
 * `pageSlug` is the already-resolved page/doc slug.
 */
export function buildWorkCanonicalUrl(
  canonical: CanonicalDecl | undefined,
  soulId: string,
  pageSlug: string,
  servingOrigin: string,
): string {
  const base = resolveCanonicalOrigin(canonical, servingOrigin)
  return `${base}/learn/${soulId}/${pageSlug}`
}

/**
 * Whether THIS serving origin is the canonical home for the Work. A subscriber
 * rendering a copy is NOT canonical — useful for showing a "Canonical source:"
 * note or for deciding whether to let the page be indexed as primary.
 */
export function isCanonicalHost(
  canonical: CanonicalDecl | undefined,
  servingOrigin: string,
): boolean {
  const declared = canonical?.origin?.trim()
  if (!declared) return true // self-canonical — the serving origin IS home
  return trimTrailingSlash(declared) === trimTrailingSlash(servingOrigin || '')
}
