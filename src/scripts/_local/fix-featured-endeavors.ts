/**
 * 260809 — The Angel OS home page was showing an endeavor literally named
 * "Claim": a tenant-less row minted on 260725 by the guardian-angel template
 * with "Claim" substituted as the portal name.
 *
 * It surfaced because the Featured Endeavors block is set to Hand-Picked but
 * has NOTHING picked, and the component falls through to "every active
 * endeavor, newest first" when the manual list is empty. So the front page was
 * auto-publishing every tenant, prototypes and accidents included.
 *
 * This deletes the junk row and fills the hand-picked list.
 *
 * Run:  railway run --service Core env DATABASE_URI="<public proxy url>" \
 *         npx payload run src/scripts/_local/fix-featured-endeavors.ts
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const JUNK_ENDEAVOR_ID = 21
const HOME_PAGE_ID = 7

/**
 * Deliberately curated, not "everything that exists":
 *   2  Clearwater Cruisin' Ministries  (has a logo)
 *   18 NeuroCare Pro
 *   15 Arctic Cool Solutions           (has a logo)
 *   20 Start-S Mobile Auto Mechanic    (has a logo)
 *   11 Dunedin Fresh Market
 * Left out on purpose: HelpDNA (a live innocence case), Stalcup for Congress
 * (a real political campaign), and the remaining prototypes.
 */
const FEATURED = [2, 18, 15, 20, 11]

const payload = await getPayload({ config: configPromise })

// ── 1. the junk row ────────────────────────────────────────────────────────
const junk = await payload
  .findByID({ collection: 'endeavors', id: JUNK_ENDEAVOR_ID, depth: 0, overrideAccess: true })
  .catch(() => null)

if (!junk) {
  console.log(`endeavor ${JUNK_ENDEAVOR_ID} already gone`)
} else {
  const j = junk as { name?: string; tenant?: unknown }
  // Guard: only ever delete the tenant-less "Claim" row, never a real endeavor.
  if (j.name !== 'Claim' || (j.tenant !== null && j.tenant !== undefined)) {
    throw new Error(`endeavor ${JUNK_ENDEAVOR_ID} is "${j.name}" with tenant ${j.tenant} — NOT the junk row. Aborting.`)
  }
  await payload.delete({ collection: 'endeavors', id: JUNK_ENDEAVOR_ID, overrideAccess: true })
  console.log(`deleted endeavor ${JUNK_ENDEAVOR_ID} ("Claim")`)
}

// ── 2. the hand-picked list ────────────────────────────────────────────────
const page = (await payload.findByID({
  collection: 'pages',
  id: HOME_PAGE_ID,
  depth: 0,
  draft: false,
  overrideAccess: true,
})) as { title?: string; layout?: Record<string, unknown>[]; _status?: string }

const layout = Array.isArray(page.layout) ? page.layout : []
const idx = layout.findIndex((b) => b?.blockType === 'featuredEndeavors')
if (idx === -1) throw new Error(`no featuredEndeavors block on page ${HOME_PAGE_ID}`)

console.log('before:', {
  source: layout[idx].source,
  picked: (layout[idx].endeavors as unknown[])?.length ?? 0,
})

layout[idx] = { ...layout[idx], source: 'manual', endeavors: FEATURED }

// _status MUST be carried explicitly — a layout update that omits it silently
// UNPUBLISHES the page (durable footgun, 046a6cf).
try {
  await payload.update({
    collection: 'pages',
    id: HOME_PAGE_ID,
    data: { layout, _status: page._status || 'published' } as never,
    overrideAccess: true,
  })
} catch (e) {
  const err = e as { data?: { errors?: unknown[] }; message?: string }
  console.error('UPDATE FAILED:', err.message)
  console.error(JSON.stringify(err.data?.errors, null, 2))
  process.exit(1)
}

const after = (await payload.findByID({
  collection: 'pages',
  id: HOME_PAGE_ID,
  depth: 1,
  draft: false,
  overrideAccess: true,
})) as { _status?: string; layout?: Record<string, unknown>[] }
const block = after.layout?.find((b) => b?.blockType === 'featuredEndeavors')

console.log('after:', {
  status: after._status,
  source: block?.source,
  picked: (block?.endeavors as { id: number; name: string }[])?.map((e) =>
    typeof e === 'object' ? `${e.id} ${e.name}` : e,
  ),
})

process.exit(0)
