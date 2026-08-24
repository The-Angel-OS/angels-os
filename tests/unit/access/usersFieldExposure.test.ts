/**
 * `users.read` is open to every signed-in person (260824), so that chat can show
 * WHO SAID SOMETHING instead of "Unknown". Payload decides row visibility before
 * field visibility — there is no way to show a peer's name without letting the
 * row through — so ALL of the protection is field-level.
 *
 * Payload gives you a blacklist, not a whitelist: a field added to Users
 * tomorrow is readable by the whole platform by default. That is exactly how
 * this quietly regresses six months from now, when nobody remembers the read
 * gate was widened. So: every field on Users must either be on the
 * approved-public list below, or carry a `read` access function.
 *
 * Adding to APPROVED_PUBLIC is a deliberate act. Ask one question first — would
 * you put this in a directory handed to every signed-in user on every portal?
 */
import { describe, it, expect } from 'vitest'
import { Users } from '@/collections/Users'

/**
 * Safe to hand any signed-in user. Name and avatar are the entire point of the
 * change; the two agent flags are what lets a client tell LEO from a person.
 */
const APPROVED_PUBLIC = new Set([
  'name',
  'avatar',
  'avatarUrl',
  // A Gravatar hash is what every Gravatar-using site puts in an <img src>.
  'gravatarHash',
  'isSystemUser',
  'servesTenant',
])

type AnyField = { name?: string; access?: { read?: unknown } }

describe('Users field exposure (260824 read widening)', () => {
  const named = (Users.fields as AnyField[]).filter((f) => typeof f.name === 'string')

  it('every field is either approved-public or carries a read gate', () => {
    const exposed = named
      .filter((f) => !APPROVED_PUBLIC.has(f.name as string))
      .filter((f) => typeof f.access?.read !== 'function')
      .map((f) => f.name)

    expect(
      exposed,
      '\nusers.read is open to EVERY signed-in user across every portal.\n' +
        'These fields ride along with the name:\n\n  ' +
        exposed.join('\n  ') +
        '\n\nAdd `access: { read: adminOrSelfFieldAccess }`, or add the field to\n' +
        'APPROVED_PUBLIC in this test if it genuinely belongs in a directory.\n',
    ).toEqual([])
  })

  it('the fields that carried the 260824 incident are gated', () => {
    for (const name of ['email', 'phone', 'roles', 'socialProviders', 'googleCalendar']) {
      const field = named.find((f) => f.name === name)
      expect(field, `${name} vanished from Users — this test is now blind to it`).toBeTruthy()
      expect(typeof field?.access?.read, `${name} is readable by every signed-in user`).toBe('function')
    }
  })

  it('the approved-public list only contains fields that exist', () => {
    const present = new Set(named.map((f) => f.name))
    for (const name of APPROVED_PUBLIC) {
      expect(present.has(name), `${name} is approved-public but no longer exists — drop it`).toBe(true)
    }
  })
})
