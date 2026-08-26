import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { PAID_ORDER_STATUSES, SETTLED_ORDER_STATUSES, isOrderPaid } from '@/utilities/orderPaid'
import { resolveTrainingAccess } from '@/utilities/trainingAccess'

/**
 * The bug this exists to prevent: for months every reader of an order's status
 * asked for `'paid'`, a value `enum_orders_status` has never contained. Nothing
 * threw — the queries simply matched nothing, so a bought training stayed
 * locked. A status word that isn't in the enum is a silent outage.
 */
function enumValuesFromMigrations(typeName: string): string[] {
  const dir = join(process.cwd(), 'src/migrations')
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.ts')) continue
    const m = readFileSync(join(dir, f), 'utf8').match(
      new RegExp(`CREATE TYPE "public"\\."${typeName}" AS ENUM\\(([^)]*)\\)`),
    )
    if (m) return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  }
  throw new Error(`${typeName} not found in migrations`)
}

describe('order paid vocabulary', () => {
  const dbValues = enumValuesFromMigrations('enum_orders_status')

  it('every status we treat as paid actually exists in the database enum', () => {
    for (const s of PAID_ORDER_STATUSES) expect(dbValues).toContain(s)
    for (const s of SETTLED_ORDER_STATUSES) expect(dbValues).toContain(s)
  })

  it("there is no 'paid' status — that was the phantom", () => {
    expect(dbValues).not.toContain('paid')
    expect(isOrderPaid('paid')).toBe(false)
    expect(isOrderPaid('processing')).toBe(true)
    expect(isOrderPaid('cancelled')).toBe(false)
  })

  it('a purchased training queries orders by a real status', async () => {
    let seen: unknown
    const payload = {
      find: async (args: { collection: string; where?: { and?: Array<Record<string, unknown>> } }) => {
        if (args.collection !== 'orders') return { docs: [] }
        seen = args.where?.and?.find((c) => 'status' in c)
        return { docs: [{ id: 1 }] }
      },
    } as never

    const res = await resolveTrainingAccess(payload, { id: 9 }, {
      id: 1,
      access: 'purchase',
      product: 42,
      owner: 'someone-else',
    })

    expect(res).toMatchObject({ allowed: true, reason: 'purchased' })
    const wanted = (seen as { status: { in: string[] } }).status.in
    for (const s of wanted) expect(dbValues).toContain(s)
  })
})
