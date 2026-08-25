/**
 * The Works registry — DB-backed.
 *
 * Replaces src/souls (getAllSouls + subscriptions.ts), where a Work's metadata
 * AND its per-portal availability lived in TypeScript manifests. That meant
 * choosing which Works a portal carries was an edit-and-deploy that only the
 * platform operator could perform. Same shape, same rules, read from `works`
 * rows so an owner can set it from their own dashboard.
 *
 * THE PLATFORM RULE is unchanged: the flagship (`platform`) is the universal
 * INDEX — it carries every Work, and is never listed in `subscribers`.
 *
 * Ownership stays a tenant SLUG rather than a relationship id: slugs are stable
 * across federated nodes, ids are not.
 */
import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

import { DEFAULT_WORK_HOME, isWorkAvailable, linkList, tagList, type WorkRecord } from './availability'

export * from './availability'

function toRecord(row: Record<string, unknown>): WorkRecord {
  const slug = String(row.slug)
  return {
    id: slug,
    title: String(row.title ?? slug),
    subtitle: String(row.subtitle ?? ''),
    description: String(row.description ?? ''),
    status: String(row.status ?? ''),
    statusColor: String(row.statusColor ?? ''),
    tags: tagList(row.tags),
    defaultDoc: String(row.defaultDoc ?? ''),
    // Chapters live as messages; getWorkJson assembles them at read time.
    docs: [],
    links: linkList(row.links),
    canonical: (row.canonical as WorkRecord['canonical']) ?? undefined,
    owner: String(row.owner || DEFAULT_WORK_HOME),
    subscribers: Array.isArray(row.subscribers) ? (row.subscribers as string[]) : [],
    availableGlobally: row.availableGlobally === true,
    optOuts: Array.isArray(row.optOuts) ? (row.optOuts as string[]) : [],
    published: row.published === true,
    storageRef: (row.storageRef as WorkRecord['storageRef']) ?? undefined,
    ...(row.type === 'book' ? { bookSlug: slug } : {}),
  }
}

/** Every Work in this node's catalog. Per-request memoized. */
export const getWorks = cache(async (): Promise<WorkRecord[]> => {
  try {
    const payload = await getPayload({ config: configPromise })
    const res = await payload.find({
      collection: 'works',
      limit: 0,
      pagination: false,
      depth: 0,
      sort: 'id',
      overrideAccess: true,
    })
    return (res.docs as unknown as Array<Record<string, unknown>>).map(toRecord)
  } catch {
    return [] // works table absent (fresh node before ensure-works-table)
  }
})

export async function getWork(slug: string): Promise<WorkRecord | null> {
  return (await getWorks()).find((w) => w.id === slug) ?? null
}

/** The public Library list for a portal: available AND published. */
export async function getAvailableWorks(tenantSlug?: string | null): Promise<WorkRecord[]> {
  return (await getWorks()).filter((w) => isWorkAvailable(w, tenantSlug) && w.published)
}

/** Available to this portal at all — published or not (direct links, owners). */
export async function isWorkAvailableBySlug(slug: string, tenantSlug?: string | null): Promise<boolean> {
  return isWorkAvailable(await getWork(slug), tenantSlug)
}
