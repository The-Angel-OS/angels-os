// Lazy payload accessor — avoids pulling @payload-config into this module's top
// level, which would create a leo-data-tools ↔ payload.config import cycle (the
// MCP plugin generates its tools FROM leo-data-tools' LEO_TOOLS at config build).
async function getLocalPayload() {
  const { getPayload } = await import('payload')
  const { default: configPromise } = await import('@payload-config')
  return getPayload({ config: configPromise })
}

/**
 * Resolve the default (oldest) space for a given tenant.
 * Returns the space ID as a string, or undefined if none found.
 *
 * Uses `sort: 'createdAt'` so the FIRST space created for the tenant
 * is returned — this is the main community space (e.g. "Angel OS Community"
 * for the default tenant), not alphabetically-first like "Angel OS Support".
 *
 * Non-critical — callers should catch and fall back gracefully.
 */
export async function fetchDefaultSpaceId(
  tenantId: number | string,
): Promise<string | undefined> {
  try {
    const payload = await getLocalPayload()
    const spaces = await payload.find({
      collection: 'spaces',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      sort: 'createdAt',
      overrideAccess: true, // Server-side utility — bypass Spaces read access (requires user)
    })
    if (spaces.docs?.[0]) {
      return String(spaces.docs[0].id)
    }
  } catch {
    // Non-critical — chat will gracefully degrade
  }
  return undefined
}
