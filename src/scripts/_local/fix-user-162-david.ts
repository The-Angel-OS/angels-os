/**
 * One-off repair — user 162 (260805 phone-OTP sign-in).
 *
 * David C signed in by text against an invitation that carried both his email
 * and his phone. The invite branch used only the phone, so the account was
 * created as "19497350665@phone.invalid" while davidc@neurocarepro.com sat on
 * the very row being read. It also predates the onboarding floor being added to
 * the SMS path, so he never got his Angel portal.
 *
 * This renames the account to the invitation's email and runs the baseline
 * grants. It does NOT merge anything — there is no second David account; the
 * invited email has never existed as a user on this node (verified 260809).
 *
 * Idempotent: re-running is a no-op once the email matches.
 *
 * Run:  railway run --service Core env DATABASE_URI="<public proxy url>" \
 *         npx payload run src/scripts/_local/fix-user-162-david.ts
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const USER_ID = 162
const TARGET_EMAIL = 'davidc@neurocarepro.com'
const TARGET_NAME = 'David Christenson'

const payload = await getPayload({ config: configPromise })

const before = await payload.findByID({
  collection: 'users',
  id: USER_ID,
  depth: 0,
  overrideAccess: true,
})
if (!before) throw new Error(`user ${USER_ID} not found`)

console.log('BEFORE:', {
  id: before.id,
  email: before.email,
  name: (before as { name?: string }).name,
  phone: (before as { phone?: string }).phone,
})

// Refuse if the target email is already taken by someone else — that would be a
// merge, which is a different and much more careful operation than a rename.
const clash = await payload.find({
  collection: 'users',
  where: { email: { equals: TARGET_EMAIL } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const clashDoc = clash.docs[0] as { id: number } | undefined
if (clashDoc && clashDoc.id !== USER_ID) {
  throw new Error(
    `${TARGET_EMAIL} already belongs to user ${clashDoc.id} — this needs a merge, not a rename. Aborting.`,
  )
}

if (before.email !== TARGET_EMAIL) {
  await payload.update({
    collection: 'users',
    id: USER_ID,
    data: { email: TARGET_EMAIL, name: TARGET_NAME } as never,
    overrideAccess: true,
  })
  console.log(`renamed ${before.email} -> ${TARGET_EMAIL}`)
} else {
  console.log('email already correct — skipping rename')
}

// The onboarding floor he never received: platform membership + his own Angel
// portal. Idempotent, and it keeps his existing Kessela tenant_admin untouched.
const { ensureBaselineMemberships } = await import('@/utilities/ensureBaselineMemberships')
const baseline = await ensureBaselineMemberships(payload, {
  id: USER_ID,
  email: TARGET_EMAIL,
  name: TARGET_NAME,
})
console.log('baseline:', baseline)

const after = await payload.findByID({ collection: 'users', id: USER_ID, depth: 0, overrideAccess: true })
console.log('AFTER:', {
  id: after.id,
  email: after.email,
  name: (after as { name?: string }).name,
  phone: (after as { phone?: string }).phone,
})

const memberships = await payload.find({
  collection: 'tenant-memberships',
  where: { user: { equals: USER_ID } },
  depth: 1,
  limit: 50,
  overrideAccess: true,
})
console.log(
  'memberships:',
  memberships.docs.map((m) => {
    const d = m as { id: number; role?: string; status?: string; tenant?: { slug?: string } | number }
    return {
      id: d.id,
      tenant: typeof d.tenant === 'object' ? d.tenant?.slug : d.tenant,
      role: d.role,
      status: d.status,
    }
  }),
)

process.exit(0)
