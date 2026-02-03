import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'
import type { Header, Footer } from '@/payload-types'

type TenantDocCollection = 'header' | 'footer'

async function getTenantDoc<T extends Header | Footer>(
  collection: TenantDocCollection,
  tenantId: number,
  depth = 0,
): Promise<T | null> {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection,
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth,
    pagination: false,
  })

  return (result.docs?.[0] as T) ?? null
}

/**
 * Fetches tenant-scoped header/footer document (replacing getCachedGlobal for multi-tenant).
 * Returns null if tenantId is null (e.g. localhost without tenant).
 */
export const getTenantCachedDoc = <T extends Header | Footer>(
  collection: TenantDocCollection,
  tenantId: number | null,
  depth = 0,
) => {
  if (tenantId == null) {
    return () => Promise.resolve(null)
  }
  return unstable_cache(
    async () => getTenantDoc<T>(collection, tenantId, depth),
    [`tenant_${collection}`, String(tenantId)],
    { tags: [`tenant_${collection}_${tenantId}`] },
  )
}
