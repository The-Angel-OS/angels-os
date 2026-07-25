import { describe, expect, it } from 'vitest'
import { Bookings } from '@/collections/Bookings'

/**
 * Customers and vendors share ONE dashboard, so a customer is `authenticated`
 * exactly like the electrician is. Bookings must therefore never be readable by
 * "any signed-in user" — that exposed every appointment on the node, across
 * every tenant, to anyone who had ever booked anything.
 */
const run = (access: unknown, user: unknown) =>
  (access as (a: { req: { user: unknown } }) => unknown)({ req: { user } })

const CLIENT = { id: 42, roles: ['customer'] }
const ADMIN = { id: 1, roles: ['super_admin'] }

describe('Bookings access', () => {
  for (const op of ['read', 'update', 'delete'] as const) {
    it(`${op}: signed-out gets nothing`, () => {
      expect(run(Bookings.access?.[op], null)).toBe(false)
    })

    it(`${op}: a plain user is scoped to bookings they are party to`, () => {
      const result = run(Bookings.access?.[op], CLIENT)
      // NOT `true` — that is the bug this guards.
      expect(result).not.toBe(true)
      expect(result).toEqual({
        or: [{ client: { equals: 42 } }, { provider: { equals: 42 } }],
      })
    })

    it(`${op}: platform admins are unscoped`, () => {
      expect(run(Bookings.access?.[op], ADMIN)).toBe(true)
    })
  }

  it('create stays open to any signed-in user — ownership is enforced on the way out', () => {
    expect(run(Bookings.access?.create, CLIENT)).toBe(true)
    expect(run(Bookings.access?.create, null)).toBe(false)
  })
})
