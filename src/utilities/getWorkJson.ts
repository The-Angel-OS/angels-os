/**
 * getWorkJson — assemble a Work's JSON from the DB (works catalog record +
 * message-backed chapters/pages). The single source of truth for BOTH the
 * works-ops API and the web /learn readers, so neither touches the filesystem.
 *
 * Returns null when the Work isn't message-backed in this node's DB (caller may
 * fall back to the file source during the transition; after file deletion, null
 * simply means "not here").
 *
 * Media is referenced by absolute URL (portable). The checksum is the content
 * address (url-independent) — see docs/planning/WORKS_AS_JSON.md.
 */
import crypto from 'crypto'
import type { Payload } from 'payload'
import { getSoul } from '@/souls'
import { isWorkAvailable, homeForWork } from '@/souls/subscriptions'

export const WORK_JSON_VERSION = 'work.v1'

export function absMedia(url: string | null | undefined, origin: string): string | null {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  if (!origin) return url
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`
}

export function checksumOf(normalized: unknown): string {
  return 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}

interface SoulLike {
  id: string
  title: string
  subtitle: string
  description: string
  status: string
  statusColor: string
  tags?: string[]
  defaultDoc?: string
  links?: { label: string; url: string }[]
  bookSlug?: string
  canonical?: { origin?: string }
}

function summarize(soul: SoulLike, origin: string, cover: string | null) {
  return {
    id: soul.id,
    title: soul.title,
    subtitle: soul.subtitle,
    description: soul.description,
    status: soul.status,
    statusColor: soul.statusColor,
    tags: soul.tags ?? [],
    type: soul.bookSlug ? 'book' : 'document',
    cover: absMedia(cover, origin),
    canonicalOrigin: soul.canonical?.origin ?? null,
    home: homeForWork(soul.id),
  }
}

export interface WorkJsonResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

/**
 * Assemble the Work JSON for `soulId` scoped to `tenantSlug`. Returns null if the
 * Work is unavailable to the tenant OR not message-backed in this DB.
 */
export async function getWorkJson(opts: {
  payload: Payload
  soulId: string
  tenantSlug?: string | null
  origin: string
}): Promise<WorkJsonResult | null> {
  const { payload, soulId, tenantSlug, origin } = opts
  const soul = getSoul(soulId) as SoulLike | null
  if (!soul) return null
  if (!isWorkAvailable(soulId, tenantSlug)) return null

  let rec: Record<string, unknown> | undefined
  try {
    const wr = await payload.find({ collection: 'works', where: { slug: { equals: soulId } }, limit: 1, depth: 0, overrideAccess: true })
    rec = (wr.docs as unknown as Array<Record<string, unknown>>)[0]
  } catch {
    return null // works table absent
  }
  const sr = rec?.storageRef as { kind?: string; space?: number; channel?: string; baseLanguage?: string; languages?: unknown } | undefined
  if (!(sr?.kind === 'messages' && sr.space && sr.channel)) return null

  // limit covers large books (e.g. the 1189-chapter Bible) — a too-low limit
  // would silently truncate trailing chapters. pagination:false fetches all.
  const res = await payload.find({
    collection: 'messages',
    where: { and: [{ space: { equals: Number(sr.space) } }, { channel: { equals: String(sr.channel) } }] },
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const chapters = (res.docs as unknown as Array<Record<string, unknown>>)
    .map((m) => ({ m, md: (m.metadata as Record<string, unknown>) || {} }))
    .filter((x) => x.md.kind === 'work_chapter')
    .sort((a, b) => ((a.md.order as number) ?? 0) - ((b.md.order as number) ?? 0))

  const coverFromChapters = (chapters.find((c) => c.md.image)?.md.image as string) ?? null

  if (soul.bookSlug) {
    const pages = chapters.map((c, i) => ({
      order: (c.md.order as number) ?? i,
      image: absMedia((c.md.image as string) ?? null, origin),
      title: (c.md.title as string) ?? null,
      slug: (c.md.slug as string) ?? String(i + 1),
      text: typeof c.m.content === 'string' ? c.m.content : ((c.m.content as { text?: string })?.text ?? ''),
      translations: (c.md.translations as Record<string, string>) ?? {},
    }))
    const checksum = checksumOf({ slug: soul.id, type: 'book', chapters: pages.map((p, i) => ({ order: i, slug: p.slug, title: p.title, text: p.text })) })
    return {
      ok: true, version: WORK_JSON_VERSION, checksum, source: 'messages',
      ...summarize(soul, origin, coverFromChapters),
      unitCount: pages.length,
      baseLanguage: sr.baseLanguage ?? 'en',
      languages: sr.languages ?? [],
      pages,
    }
  }

  const docs = chapters.map((c, i) => ({
    id: String((c.md.chapterSlug as string) ?? c.m.id),
    title: (c.md.title as string) ?? '',
    date: (c.md.date as string) ?? '',
    description: (c.md.description as string) ?? '',
    tier: (c.md.tier as string) ?? 'chapter',
    badge: (c.md.badge as string) ?? null,
    badgeColor: (c.md.badgeColor as string) ?? null,
    image: absMedia((c.md.image as string) ?? null, origin),
    body: typeof c.m.content === 'string' ? c.m.content : ((c.m.content as { text?: string })?.text ?? ''),
    order: i,
  }))
  const checksum = checksumOf({ slug: soul.id, type: 'document', chapters: docs.map((d, i) => ({ order: i, slug: d.id, title: d.title, tier: d.tier, body: d.body })) })
  return {
    ok: true, version: WORK_JSON_VERSION, checksum, source: 'messages',
    ...summarize(soul, origin, coverFromChapters),
    unitCount: docs.length,
    defaultDoc: soul.defaultDoc,
    links: soul.links ?? [],
    docs,
  }
}
