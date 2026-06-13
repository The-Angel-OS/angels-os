/**
 * revalidateTenantDoc — bust the getTenantCachedDoc cache tag when a tenant's
 * header/footer/site-settings doc changes, so edits show immediately instead of
 * waiting out the cache TTL. Pairs with getTenantCachedDoc (same tag shape:
 * `tenant_<collection>_<tenantId>`).
 */
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidateTag } from 'next/cache'

const tenantIdOf = (doc: unknown): string | number | null => {
  const t = (doc as { tenant?: unknown } | null)?.tenant
  if (t != null && typeof t === 'object') return (t as { id?: string | number }).id ?? null
  return (t as string | number | null) ?? null
}

export function revalidateTenantDoc(collection: 'header' | 'footer' | 'site-settings') {
  const bust = (doc: unknown) => {
    const t = tenantIdOf(doc)
    if (t != null) {
      try {
        revalidateTag(`tenant_${collection}_${t}`, 'default')
      } catch {
        /* revalidateTag is a no-op outside a request scope — safe to ignore */
      }
    }
  }
  const afterChange: CollectionAfterChangeHook = ({ doc }) => {
    bust(doc)
    return doc
  }
  const afterDelete: CollectionAfterDeleteHook = ({ doc }) => {
    bust(doc)
    return doc
  }
  return { afterChange, afterDelete }
}
