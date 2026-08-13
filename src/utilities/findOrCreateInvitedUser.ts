/**
 * findOrCreateInvitedUser — an invitation names a PERSON, so it creates one.
 *
 * Before this, an invite was a note about somebody who didn't exist yet, and
 * every sign-in door had to guess which note was about the person knocking.
 * The doors guessed differently: a space invite parked the pending membership on
 * the INVITER's user id as a placeholder, a tenant invite left `user` empty, and
 * phone sign-in reverse-engineered an identity out of `invitationDetails`. When
 * that reverse-engineering missed, the same human got a second account — 260805,
 * David C signed in by text and landed on `19497350665@phone.invalid` while
 * `davidc@neurocarepro.com` sat on the very invite row being read.
 *
 * Creating the user up front deletes the guessing. The invite holds a real `user`
 * FK, and every credential the invitee later proves — Google, email code, texted
 * code — resolves to that same row by construction.
 *
 * The account is a SHELL: a discarded random password (nobody is told it) and
 * `_verified: false`. It cannot be logged into until the invitee proves they hold
 * one of its addresses, which is exactly the state an uninvited stranger is in.
 * `verify` is not enabled on the Users auth config, so the flag is a record of
 * what we know about this person, not a gate — the gate is possession.
 *
 * Email is the identity anchor when present, because it is what Google and email
 * codes match on. A phone-only invite gets an RFC-reserved `.invalid` placeholder
 * address so the row can exist; pass BOTH when the admin knows both, and the one
 * account then answers to both doors.
 *
 * @see src/utilities/invitationSystem.ts — space invites
 * @see src/app/[locale]/(dashboard)/dashboard/admin/invitations/actions.ts — tenant invites
 * @see project_identity_graph_model — many credentials, one Person
 */
import crypto from 'crypto'
import type { Payload, PayloadRequest, Where } from 'payload'
import { normalizeEmail, normalizePhone } from '@/utilities/otpLogin'

// Inlined rather than imported from invitationSystem — that module imports THIS
// one, and the cycle resolves to `undefined` at call time under ESM.
const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

export interface InvitedIdentity {
  email?: string | null
  phone?: string | null
  /** Display name the admin typed, if any. Never overwrites a name already set. */
  name?: string | null
}

export interface FindOrCreateInvitedUserResult {
  userId: number | string
  /** true when this call minted the shell account. */
  created: boolean
  /** The normalized address the account is anchored on. */
  email: string
  phone?: string
}

/** `+15551234567` → `15551234567@phone.invalid` (RFC 2606 — never deliverable). */
export const phonePlaceholderEmail = (phone: string): string =>
  `${phone.replace(/^\+/, '')}@phone.invalid`

/**
 * Flip an invite-created shell to verified — call on any SUCCESSFUL sign-in.
 *
 * An invitation is an admin's word that an address belongs to a person; a
 * completed sign-in is the person answering at it. That is the moment the shell
 * stops being a claim and becomes an account. Fail-soft and idempotent: nothing
 * about signing in should depend on this bookkeeping succeeding.
 */
export async function markUserVerified(
  payload: Payload,
  user: { id: number | string; _verified?: boolean | null } | undefined | null,
): Promise<void> {
  if (!user?.id || user._verified) return
  try {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { _verified: true } as never,
      overrideAccess: true,
    })
  } catch (err) {
    payload.logger?.warn?.(
      `[markUserVerified] could not verify user ${user.id}: ${err instanceof Error ? err.message : err}`,
    )
  }
}

/**
 * Resolve an invitee to a user row, creating a shell account when they're new.
 *
 * Lookup order is email then phone — an invite for someone who already signed in
 * with Google must attach to THAT person, never mint a rival. When an existing
 * account is found and the invite carries a phone it doesn't have yet, the phone
 * is attached: the admin vouching for the pairing is the same signal
 * `verifyOtpSms` already trusts.
 *
 * Throws when given neither a usable email nor a usable phone — a caller with no
 * anchor at all has nothing to invite.
 */
export async function findOrCreateInvitedUser(
  payload: Payload,
  identity: InvitedIdentity,
  opts: { req?: PayloadRequest } = {},
): Promise<FindOrCreateInvitedUserResult> {
  const { req } = opts

  const rawEmail = (identity.email || '').trim()
  const email = rawEmail ? normalizeEmail(rawEmail) : ''
  const hasEmail = Boolean(email) && isValidEmail(email)

  const rawPhone = (identity.phone || '').trim()
  const phone = rawPhone ? normalizePhone(rawPhone) : ''
  const hasPhone = /^\+[1-9]\d{7,14}$/.test(phone)

  if (!hasEmail && !hasPhone) {
    throw new Error('An invitation needs an email address or a mobile number.')
  }

  const name = (identity.name || '').trim() || undefined

  // ── Existing person? Email first, then phone. ────────────────────────────
  const findBy = async (where: Where) => {
    const found = await payload.find({
      collection: 'users',
      where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    return found.docs[0] as { id: number | string; phone?: string; name?: string } | undefined
  }

  let user = hasEmail ? await findBy({ email: { equals: email } }) : undefined
  if (!user && hasPhone) user = await findBy({ phone: { equals: phone } })

  if (user) {
    // Fill the blanks the invite can answer. Never overwrite what's already set —
    // the person's own account beats an admin's typing.
    const patch: Record<string, unknown> = {}
    if (hasPhone && !user.phone) patch.phone = phone
    if (name && !user.name) patch.name = name
    if (Object.keys(patch).length > 0) {
      try {
        await payload.update({
          collection: 'users',
          id: user.id,
          data: patch as never,
          overrideAccess: true,
          req,
        })
      } catch (err) {
        // Fail-soft: an unfillable blank must never sink the invitation.
        payload.logger?.warn?.(
          `[findOrCreateInvitedUser] could not enrich user ${user.id}: ${err instanceof Error ? err.message : err}`,
        )
      }
    }
    return {
      userId: user.id,
      created: false,
      email: hasEmail ? email : phonePlaceholderEmail(phone),
      ...(hasPhone ? { phone } : {}),
    }
  }

  // ── New person — mint the shell. ─────────────────────────────────────────
  const anchorEmail = hasEmail ? email : phonePlaceholderEmail(phone)
  const created = await payload.create({
    collection: 'users',
    data: {
      email: anchorEmail,
      // Discarded on purpose: the invitee never receives it and never needs it.
      // They get in by proving an address, not by knowing a secret.
      password: crypto.randomUUID() + crypto.randomUUID(),
      ...(hasPhone ? { phone } : {}),
      ...(name ? { name } : {}),
      // An invitation is somebody's word that this address belongs to a person.
      // It is not proof, so the account starts unverified and the first successful
      // sign-in is what flips it.
      _verified: false,
    } as never,
    overrideAccess: true,
    req,
  })

  return {
    userId: created.id,
    created: true,
    email: anchorEmail,
    ...(hasPhone ? { phone } : {}),
  }
}
