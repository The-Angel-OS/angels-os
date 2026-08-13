/**
 * findOrCreateInvitedUser — the identity contract for invitations.
 *
 * The bug this guards against: the same human ending up with two accounts
 * because the invite and the sign-in matched on different anchors.
 *
 * @see src/utilities/findOrCreateInvitedUser.ts
 */
import { describe, it, expect, vi } from 'vitest'
import { findOrCreateInvitedUser, phonePlaceholderEmail } from '@/utilities/findOrCreateInvitedUser'

type Row = { id: number; email?: string; phone?: string; name?: string }

/** Minimal Payload stand-in backed by an array of user rows. */
function fakePayload(users: Row[] = []) {
  let nextId = Math.max(0, ...users.map((u) => u.id)) + 1
  const created: Row[] = []
  const updated: Array<{ id: number; data: Record<string, unknown> }> = []

  const payload = {
    logger: { warn: vi.fn() },
    find: vi.fn(async ({ where }: { where: Record<string, any> }) => {
      const email = where?.email?.equals
      const phone = where?.phone?.equals
      const hit = users.find((u) =>
        email !== undefined ? u.email === email : phone !== undefined ? u.phone === phone : false,
      )
      return { docs: hit ? [hit] : [] }
    }),
    create: vi.fn(async ({ data }: { data: Row }) => {
      const row = { ...data, id: nextId++ }
      users.push(row)
      created.push(row)
      return row
    }),
    update: vi.fn(async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const row = users.find((u) => u.id === id)!
      Object.assign(row, data)
      updated.push({ id, data })
      return row
    }),
  }
  return { payload: payload as never, users, created, updated }
}

describe('findOrCreateInvitedUser', () => {
  it('mints an UNVERIFIED shell for someone brand new', async () => {
    const { payload, created } = fakePayload()
    const r = await findOrCreateInvitedUser(payload, { email: 'New@Example.com', name: 'New Person' })

    expect(r.created).toBe(true)
    expect(r.email).toBe('new@example.com') // normalized
    expect(created[0]).toMatchObject({ email: 'new@example.com', name: 'New Person', _verified: false })
    // A password is set but never disclosed — the account can't be logged into
    // until they prove an address.
    expect(String((created[0] as Record<string, unknown>).password ?? '').length).toBeGreaterThan(20)
  })

  it('attaches to the EXISTING person rather than minting a rival', async () => {
    const { payload, created } = fakePayload([{ id: 7, email: 'davidc@neurocarepro.com' }])
    const r = await findOrCreateInvitedUser(payload, { email: 'DavidC@neurocarepro.com' })

    expect(r.created).toBe(false)
    expect(r.userId).toBe(7)
    expect(created).toHaveLength(0)
  })

  // The 260805 failure, inverted: invite with both anchors, and the one account
  // answers to a texted code AND to Google.
  it('attaches a new phone to an existing email account', async () => {
    const { payload, users } = fakePayload([{ id: 7, email: 'davidc@neurocarepro.com' }])
    const r = await findOrCreateInvitedUser(payload, {
      email: 'davidc@neurocarepro.com',
      phone: '(949) 735-0665',
    })

    expect(r.created).toBe(false)
    expect(r.phone).toBe('+19497350665') // normalized to E.164
    expect(users[0]!.phone).toBe('+19497350665')
  })

  it('finds by phone when the invite carries no email', async () => {
    const { payload, created } = fakePayload([{ id: 9, email: 'ron@example.com', phone: '+13042831259' }])
    const r = await findOrCreateInvitedUser(payload, { phone: '+13042831259' })

    expect(r.userId).toBe(9)
    expect(created).toHaveLength(0)
  })

  it('never overwrites a name the person already has', async () => {
    const { payload, users } = fakePayload([{ id: 3, email: 'ken@example.com', name: 'Kenneth Courtney' }])
    await findOrCreateInvitedUser(payload, { email: 'ken@example.com', name: 'K' })

    expect(users[0]!.name).toBe('Kenneth Courtney')
  })

  it('a phone-only invite anchors on an undeliverable .invalid address', async () => {
    const { payload } = fakePayload()
    const r = await findOrCreateInvitedUser(payload, { phone: '+15551234567' })

    expect(r.created).toBe(true)
    expect(r.email).toBe('15551234567@phone.invalid')
    expect(phonePlaceholderEmail('+15551234567')).toBe('15551234567@phone.invalid')
  })

  it('refuses an invitation with no anchor at all', async () => {
    const { payload } = fakePayload()
    await expect(findOrCreateInvitedUser(payload, { name: 'Nobody' })).rejects.toThrow(
      /email address or a mobile number/i,
    )
    await expect(findOrCreateInvitedUser(payload, { email: 'not-an-email' })).rejects.toThrow()
  })
})
