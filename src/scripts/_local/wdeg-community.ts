/**
 * Where Did Everyone Go — make the community joinable and give it ONE room.
 *
 * Three findings, from the live node:
 *
 *  1. Tenant 11 has no membership plans at all, so there is no join surface and
 *     nothing for a reader of the book to say yes to. It gets a free one.
 *
 *  2. Two spaces both claim to be the community — 34 "Community" (is_main, the
 *     town square, where ensureMainSpace lands people) and 40 "Community Hub"
 *     (a stray from an earlier provisioning). 40 folds into 34.
 *
 *  3. Even inside 34 there are two general-purpose rooms, `main` (14) and
 *     `general` (2, plus whatever 40 brings). Ten human messages split across
 *     two rooms reads as a dead community twice over. `general` folds into
 *     `main` — the channel ensureMainSpace marks default.
 *
 * Idempotent: re-running finds the plan already there, space 40 already gone,
 * and `general` already folded.
 *
 * Run: DATABASE_URI=<live> npx payload run src/scripts/_local/wdeg-community.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { executeToolCall } from '@/utilities/leo-data-tools'
import { spaceDeleteHandler } from '@/endpoints/space-delete'

const payload = await getPayload({ config })
const SLUG = 'wheredideveryonego'
const SURVIVING_SPACE = 34
const STRAY_SPACE = 40
const KEEP_CHANNEL = 'main'
const FOLD_CHANNEL = 'general'

const t = await payload.find({
  collection: 'tenants', where: { slug: { equals: SLUG } }, limit: 1, depth: 0, overrideAccess: true,
})
const tenant = t.docs[0] as { id: number } | undefined
if (!tenant) throw new Error(`no portal "${SLUG}"`)
const tenantId = Number(tenant.id)

const user = (await payload.findByID({
  collection: 'users', id: 3, depth: 0, overrideAccess: true,
})) as { id: number; email: string; roles?: string[] }

// ── 1. The free plan ────────────────────────────────────────────────────────
const out = await executeToolCall(
  'create_membership_plan',
  {
    name: 'Reader',
    amountUsd: 0,
    interval: 'month',
    description:
      'Free. You get the community, the discussion, and a note when there is something new to read.',
    tenantSlug: SLUG,
  },
  { payload, userId: user.id, roles: user.roles ?? ['super_admin'] },
)
console.log('plan:', out.split('\n')[0])

// ── 2. Fold the stray space into the town square ────────────────────────────
const stray = await payload
  .findByID({ collection: 'spaces', id: STRAY_SPACE, depth: 0, overrideAccess: true })
  .catch(() => null)

if (!stray) {
  console.log(`space ${STRAY_SPACE}: already gone`)
} else {
  // The endpoint IS the merge — plan and execution are one code path, and it
  // carries the members over and rewrites the messages. Called directly rather
  // than over HTTP so this needs no session; the authorization inside still runs
  // against the real user.
  const req = {
    payload,
    user,
    method: 'POST',
    url: 'http://localhost/api/space-ops/delete',
    headers: new Headers(),
    json: async () => ({ spaceId: STRAY_SPACE, reassignTo: SURVIVING_SPACE }),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await spaceDeleteHandler(req as any)
  console.log(`space ${STRAY_SPACE} →`, JSON.stringify(await (res as Response).json()).slice(0, 400))
}

// ── 3. One room, not two ────────────────────────────────────────────────────
const chans = await payload.find({
  collection: 'channels',
  where: { space: { equals: SURVIVING_SPACE } },
  limit: 0, depth: 0, overrideAccess: true,
})
const byslug = new Map(
  (chans.docs as Array<{ id: number; slug?: string }>).map((c) => [c.slug ?? '', c.id]),
)
const keepId = byslug.get(KEEP_CHANNEL)
const foldId = byslug.get(FOLD_CHANNEL)

if (!keepId || !foldId) {
  console.log(`fold: nothing to do (main=${keepId} general=${foldId})`)
} else {
  // Messages key on the channel SLUG *and* channelRef — rewrite both or half
  // the reads miss them.
  const msgs = await payload.find({
    collection: 'messages',
    where: { channelRef: { equals: foldId } },
    limit: 0, depth: 0, overrideAccess: true,
  })
  for (const m of msgs.docs as Array<{ id: number }>) {
    await payload.update({
      collection: 'messages', id: m.id,
      data: { channel: KEEP_CHANNEL, channelRef: keepId },
      overrideAccess: true,
    })
  }
  await payload.delete({ collection: 'channels', id: foldId, overrideAccess: true })
  // Verify by RE-QUERYING — delete resolves with an errors array, it does not throw.
  const still = await payload
    .findByID({ collection: 'channels', id: foldId, depth: 0, overrideAccess: true })
    .catch(() => null)
  console.log(`fold: moved ${msgs.docs.length} messages → ${KEEP_CHANNEL}; general ${still ? 'STILL PRESENT' : 'removed'}`)
}

// ── Report ──────────────────────────────────────────────────────────────────
const spaces = await payload.find({
  collection: 'spaces', where: { tenant: { equals: tenantId } }, limit: 0, depth: 0, overrideAccess: true,
})
console.log(
  '\nspaces now:',
  (spaces.docs as Array<{ id: number; name: string; visibility: string }>)
    .map((s) => `${s.id}:${s.name}(${s.visibility})`).join('  '),
)
const { getMembershipPlans } = await import('@/utilities/membershipPlans')
console.log('plans now:', (await getMembershipPlans(payload, tenantId)).map((p) => `${p.id}=$${p.amountCents / 100}`).join('  '))
