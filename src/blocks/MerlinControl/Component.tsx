import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getJsonSetting } from '@/services/SettingService'
import { MerlinControlView, type MerlinNode } from './View'

type MerlinControlBlockProps = {
  endeavor?: string | null
  showNav?: boolean | null
  heading?: string | null
  blockType?: 'merlinControl'
}

// Mirrors node-ops.ts storage: settings bag keyed by ('merlin-nodes', endeavor) on the platform tenant.
async function listNodes(endeavor: string): Promise<MerlinNode[]> {
  const payload = await getPayload({ config: configPromise })
  let tenantId: number | string = 1
  try {
    const res = await payload.find({
      collection: 'tenants',
      where: { type: { equals: 'platform' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const id = (res.docs?.[0] as { id?: number | string } | undefined)?.id
    if (id != null) tenantId = id
  } catch {
    /* default tenant 1 */
  }
  const map =
    (await getJsonSetting<Record<string, MerlinNode>>(
      payload,
      { entityName: 'merlin-nodes', entityId: endeavor, tenantId },
      'nodes',
    )) || {}
  return Object.values(map).sort((a, b) =>
    String(b.lastSeen || '').localeCompare(String(a.lastSeen || '')),
  )
}

export const MerlinControlBlock: React.FC<
  MerlinControlBlockProps & { id?: string | number; className?: string }
> = async ({ endeavor, showNav = true, heading }) => {
  if (!endeavor) {
    return (
      <section className="container py-8">
        <p className="text-muted-foreground">Merlin Control: set an endeavor slug to list nodes.</p>
      </section>
    )
  }
  const nodes = await listNodes(endeavor)
  return (
    <section className="container py-8">
      {heading && <h2 className="mb-4 text-2xl font-bold">{heading}</h2>}
      {/* Bound to ~one screenful so the control fits the inner window (header/footer
          stay put) and its panes scroll internally instead of sprawling the page. */}
      <div className="h-[calc(100dvh-14rem)] min-h-[30rem]">
        <MerlinControlView nodes={nodes} showNav={showNav !== false} endeavor={endeavor} />
      </div>
    </section>
  )
}
