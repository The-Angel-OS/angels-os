import type { Payload } from 'payload'

/**
 * resolveRedirect — consult the tenant's redirect map for a path that didn't
 * match any real route. Called from the frontend 404 paths (single-segment
 * [slug] page and the multi-segment catch-all) just before notFound().
 * Normalization mirrors the collection's beforeValidate on `from`.
 */
export async function resolveRedirect(
  payload: Payload,
  tenantId: number | string | undefined,
  rawPath: string,
): Promise<string | null> {
  if (!tenantId) return null
  let path = String(rawPath || '').split('?')[0].split('#')[0]
  if (!path.startsWith('/')) path = `/${path}`
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  path = path.toLowerCase()
  if (path === '/') return null

  try {
    const result = await payload.find({
      collection: 'redirects' as never,
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { from: { equals: path } },
          { enabled: { equals: true } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = result.docs[0] as { to?: string } | undefined
    const to = typeof doc?.to === 'string' ? doc.to.trim() : ''
    return to || null
  } catch {
    return null // a redirect-lookup failure must never break the 404 page
  }
}
