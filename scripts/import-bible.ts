/**
 * import-bible.ts — materialize the Holy Bible (or any book Work) as message-backed
 * chapters via the Payload Local API, locally (no serverless timeout).
 *
 * Why a local script (not just the HTTP endpoint): the 1189-chapter Bible 504s in
 * one serverless invocation. The works-ops/import endpoint is now chunked for prod
 * use, but locally we have no timeout, so this script does the whole book in one
 * clean pass — clearing first (fixing the duplicate/partial mess), carrying the
 * book→chapter hierarchy, and writing the works catalog row at the end. It mirrors
 * worksImportHandler's book branch exactly (same metadata + checksum shape).
 *
 * Run (against angels / spacesangels.com):
 *   npx cross-env NODE_OPTIONS=--no-deprecation PAYLOAD_MIGRATING=true \
 *     DATABASE_URI="postgresql://…/angels" DATABASE_SSL=require \
 *     npx tsx scripts/import-bible.ts --soul=holy-bible --tenant=platform [--origin=https://spacesangels.com]
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { getSoul } from '../src/souls'
import { homeForWork, subscribersForWork } from '../src/souls/subscriptions'
import { loadBookFromPublic, loadBookFromOrigin } from '../src/components/Library/bookManifestServer'
import { checksumOf, WORK_JSON_VERSION } from '../src/utilities/getWorkJson'

function arg(name: string, fallback = ''): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

async function main() {
  process.env.PAYLOAD_MIGRATING = 'true'
  const soulId = arg('soul', 'holy-bible')
  const hostSlug = arg('tenant') || homeForWork(soulId)
  const origin = arg('origin', 'https://spacesangels.com')

  const soul = getSoul(soulId)
  if (!soul) throw new Error(`soul '${soulId}' not found`)
  if (!soul.bookSlug) throw new Error(`soul '${soulId}' is not a book work`)

  const payload = await getPayload({ config })
  console.log(`DB: ${process.env.DATABASE_URI?.split('/').pop()?.split('?')[0]}  soul=${soulId}  host=${hostSlug}`)

  const tRes = await payload.find({ collection: 'tenants', where: { slug: { equals: hostSlug } }, limit: 1, depth: 0, overrideAccess: true })
  const tenant = (tRes.docs as Array<{ id: number }>)[0]
  if (!tenant) throw new Error(`host tenant '${hostSlug}' not on this DB`)
  const sRes = await payload.find({ collection: 'spaces', where: { tenant: { equals: tenant.id } }, limit: 1, sort: 'createdAt', depth: 0, overrideAccess: true })
  const space = (sRes.docs as Array<{ id: number }>)[0]
  if (!space) throw new Error(`no space on '${hostSlug}'`)
  const channel = `work-${soulId}`
  console.log(`tenant=${tenant.id} space=${space.id} channel=${channel}`)

  const loaded = loadBookFromPublic(soul.bookSlug) ?? (await loadBookFromOrigin(soul.bookSlug, origin))
  if (!loaded) throw new Error('book manifest unreadable (fs + origin both failed)')
  const langs = (loaded.manifest.languages ?? []).map((l) => l.code)
  const baseLang = loaded.baseLanguage
  const pages = loaded.manifest.pages
  console.log(`manifest: ${pages.length} pages, langs=[${langs.join(',')}], base=${baseLang}`)

  // Per-language text from origin (verse-structured for scripture).
  const langText: Record<string, Record<string, unknown>> = {}
  for (const code of langs) {
    try {
      const r = await fetch(`${origin}/library/${soul.bookSlug}/text/${code}.json`)
      if (r.ok) langText[code] = (await r.json()) as Record<string, unknown>
      console.log(`  text/${code}.json: ${r.ok ? 'ok' : `HTTP ${r.status}`}`)
    } catch (e) { console.log(`  text/${code}.json: ${e instanceof Error ? e.message : e}`) }
  }
  langText[baseLang] = langText[baseLang] ?? (loaded.baseText as Record<string, unknown>)

  // Clean slate — fixes the duplicate/partial 1746-row mess from prior 504s.
  const del = await payload.delete({ collection: 'messages', where: { and: [{ space: { equals: space.id } }, { channel: { equals: channel } }] }, overrideAccess: true })
  console.log(`cleared ${Array.isArray((del as { docs?: unknown[] }).docs) ? (del as { docs: unknown[] }).docs.length : '?'} existing messages`)

  type PageH = (typeof pages)[number] & { book?: string; bookName?: string; chapter?: number; ref?: string }
  let chapters = 0
  const t0 = Date.now()
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i] as PageH
    const ord = String(p.order)
    const translations: Record<string, unknown> = {}
    for (const code of langs) translations[code] = langText[code]?.[ord] ?? ''
    const baseVal = translations[baseLang]
    await payload.create({
      collection: 'messages',
      overrideAccess: true,
      data: {
        space: space.id, channel, messageType: 'system', visibility: 'tenant',
        content: { type: 'text', text: typeof baseVal === 'string' ? baseVal : '' },
        metadata: {
          kind: 'work_chapter', workSlug: soulId, order: i,
          slug: loaded.pageSlugs[i], title: loaded.pageTitles[i] || p.title || null,
          image: p.image ?? null,
          book: p.book ?? null, bookName: p.bookName ?? null,
          chapter: typeof p.chapter === 'number' ? p.chapter : null, ref: p.ref ?? null,
          translations,
        },
      },
    })
    chapters++
    if (chapters % 100 === 0) console.log(`  ${chapters}/${pages.length} (${Math.round((Date.now() - t0) / 1000)}s)`) 
  }

  const checksum = checksumOf({
    slug: soulId, type: 'book',
    chapters: pages.map((p, i) => {
      const t = langText[baseLang]?.[String(p.order)]
      return { order: i, slug: loaded.pageSlugs[i], title: loaded.pageTitles[i], text: typeof t === 'string' ? t : JSON.stringify(t ?? '') }
    }),
  })

  const recData = {
    slug: soulId, title: soul.title, subtitle: soul.subtitle, description: soul.description,
    type: 'book' as const, status: soul.status, statusColor: soul.statusColor,
    tags: soul.tags ?? [], canonical: soul.canonical ?? null,
    owner: homeForWork(soulId), subscribers: subscribersForWork(soulId),
    storageRef: { kind: 'messages', space: space.id, channel, baseLanguage: baseLang, languages: loaded.manifest.languages ?? [] },
    checksum, jsonVersion: WORK_JSON_VERSION,
  }
  const existing = await payload.find({ collection: 'works', where: { slug: { equals: soulId } }, limit: 1, depth: 0, overrideAccess: true })
  const ex = (existing.docs as Array<{ id: number }>)[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = recData as any
  if (ex) await payload.update({ collection: 'works', id: ex.id, data, overrideAccess: true })
  else await payload.create({ collection: 'works', data, overrideAccess: true })

  console.log(`\nDONE: ${chapters} chapters, works row ${ex ? 'updated' : 'created'}, checksum ${checksum.slice(0, 20)}…`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
