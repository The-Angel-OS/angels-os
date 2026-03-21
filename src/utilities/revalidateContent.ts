/**
 * Content Cache Invalidation — Sprint 44
 *
 * Shared utility for busting Next.js caches after content mutations.
 * Called by LEO tool executor after update/create operations so the
 * frontend immediately reflects changes (no stale cache).
 *
 * Uses two strategies:
 *   1. revalidateTag() — busts unstable_cache entries for tenant-scoped docs
 *   2. revalidatePath() — busts route-level cache for specific pages
 *
 * Fire-and-forget: failures are silently caught (expected outside Next.js server).
 */

import { revalidatePath, revalidateTag } from 'next/cache'

export interface RevalidationOptions {
  /** The Payload collection slug that was mutated */
  collection: string
  /** Tenant ID — used for tag-based cache busting */
  tenantId?: number
  /** Page/post slug — used for path-based cache busting */
  slug?: string
}

/**
 * Bust caches after a content mutation.
 *
 * Call this after any LEO tool that creates or updates content.
 * Safe to call from any context — silently no-ops outside Next.js server.
 */
export function revalidateAfterMutation(opts: RevalidationOptions): void {
  try {
    // ── Tag-based: bust unstable_cache for tenant-scoped docs ──────────
    // Next.js 16 requires a cache profile as 2nd arg to revalidateTag()
    if (opts.tenantId) {
      revalidateTag(`tenant_site-settings_${opts.tenantId}`, 'default')
      revalidateTag(`tenant_header_${opts.tenantId}`, 'default')
      revalidateTag(`tenant_footer_${opts.tenantId}`, 'default')
    }

    // ── Path-based: bust route cache for specific content ─────────────
    switch (opts.collection) {
      case 'pages': {
        if (opts.slug) {
          const path = opts.slug === 'home' ? '/' : `/${opts.slug}`
          revalidatePath(path)
        }
        break
      }
      case 'posts': {
        if (opts.slug) {
          revalidatePath(`/posts/${opts.slug}`)
        }
        // Also bust the posts listing page
        revalidatePath('/posts')
        break
      }
      case 'products': {
        if (opts.slug) {
          revalidatePath(`/products/${opts.slug}`)
        }
        // Also bust the products listing page
        revalidatePath('/products')
        break
      }
      case 'events': {
        if (opts.slug) {
          revalidatePath(`/events/${opts.slug}`)
        }
        revalidatePath('/events')
        break
      }
      case 'media': {
        // Media changes can affect any page — bust tenant tags only
        break
      }
      default: {
        // For other collections, just bust tenant tags (already done above)
        break
      }
    }
  } catch {
    // Expected when running outside Next.js server (e.g. CLI, tests, seed scripts)
  }
}
