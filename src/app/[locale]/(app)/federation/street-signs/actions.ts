'use server'

import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Track a street sign impression (shown in search results).
 * Fire-and-forget — errors are silently caught.
 */
export async function trackStreetSignImpression(signId: number | string): Promise<void> {
  try {
    const payload = await getPayload({ config })
    const doc = await payload.findByID({
      collection: 'street-signs',
      id: String(signId),
      depth: 0,
      overrideAccess: true,
      select: { impressions: true } as any,
    })
    await payload.update({
      collection: 'street-signs',
      id: String(signId),
      data: {
        impressions: ((doc as any)?.impressions || 0) + 1,
      },
      overrideAccess: true,
    })
  } catch {
    // Silent — tracking should never break the UX
  }
}

/**
 * Track a street sign click-through (user clicked to source).
 * Fire-and-forget — errors are silently caught.
 */
export async function trackStreetSignClick(signId: number | string): Promise<void> {
  try {
    const payload = await getPayload({ config })
    const doc = await payload.findByID({
      collection: 'street-signs',
      id: String(signId),
      depth: 0,
      overrideAccess: true,
      select: { clickThroughs: true } as any,
    })
    await payload.update({
      collection: 'street-signs',
      id: String(signId),
      data: {
        clickThroughs: ((doc as any)?.clickThroughs || 0) + 1,
      },
      overrideAccess: true,
    })
  } catch {
    // Silent — tracking should never break the UX
  }
}
