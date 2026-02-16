import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * Resolve the first (default) space for a given tenant.
 * Returns the space ID as a string, or undefined if none found.
 *
 * Non-critical — callers should catch and fall back gracefully.
 */
export async function fetchDefaultSpaceId(
  tenantId: number | string,
): Promise<string | undefined> {
  try {
    const payload = await getPayload({ config: configPromise })
    const spaces = await payload.find({
      collection: 'spaces',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
    })
    if (spaces.docs?.[0]) {
      return String(spaces.docs[0].id)
    }
  } catch {
    // Non-critical — chat will gracefully degrade
  }
  return undefined
}
