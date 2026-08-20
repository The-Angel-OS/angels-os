import type { CollectionAfterChangeHook } from 'payload'
import { tenantBySlugCache, tenantByDomainCache } from '@/utilities/tenantCache'

/**
 * Drop the cached copy of a tenant the moment it is saved.
 *
 * `fetchTenantBySlug` / `fetchTenantByDomain` hold a tenant for 120s in prod, so
 * an owner who uploaded a new logo, saved, and came back to Settings within two
 * minutes was served the OLD document and saw their old image — indistinguishable
 * from the save having failed. The cache class has always had an `invalidate`
 * whose own comment said "e.g. after admin update"; nothing ever called it.
 *
 * Every key this document can be reached by is busted, old value included: a save
 * that CHANGES the slug or domain would otherwise leave the previous key pointing
 * at a stale doc until it expired.
 *
 * Fail-soft — a cache miss is free, a throw here would block the save.
 *
 * @see src/utilities/tenantCache.ts
 * @see src/utilities/renamePortalSlug.ts — the same busting, for a rename
 */
export const invalidateTenantCache: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
  try {
    const slugs = new Set<string>()
    const domains = new Set<string>()

    for (const d of [doc, previousDoc]) {
      if (!d) continue
      const t = d as { slug?: string; domain?: string; domains?: Array<{ domain?: string }> }
      if (t.slug) slugs.add(t.slug)
      if (t.domain) domains.add(t.domain)
      for (const alias of t.domains || []) if (alias?.domain) domains.add(alias.domain)
    }

    for (const s of slugs) tenantBySlugCache.invalidate(s)
    for (const d of domains) {
      tenantByDomainCache.invalidate(d)
      tenantByDomainCache.invalidate(`exact:${d}`)
    }
  } catch {
    /* never let cache bookkeeping fail a save */
  }
  return doc
}
