/**
 * Fund a Diocese float — POST /api/provision-ops/fund-float
 *
 * The controlled AT issuance point. Credits an Enterprise's float (backed AT into
 * circulation), recorded on the hash-linked TokenLedger. Quest payouts draw from
 * the float. Auth: super_admin OR ?key=<CRON_SECRET> (this mints value — gate it).
 *
 * Body: { tenantId, amount (minor units, positive int), tokenKind?='AT', reason?, ref? }
 *
 * @see src/utilities/fundFloat.ts
 */
import type { PayloadHandler } from 'payload'
import { fundFloat } from '@/utilities/fundFloat'

export const fundFloatHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (typeof req.json === 'function' ? await req.json() : {}) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const tenantId = body.tenantId as number | string | undefined
  const amount = Number(body.amount)
  if (tenantId == null) return Response.json({ error: 'tenantId required' }, { status: 400 })
  if (!Number.isInteger(amount) || amount <= 0) {
    return Response.json({ error: 'amount must be a positive integer (minor units)' }, { status: 400 })
  }

  const result = await fundFloat(payload, {
    tenantId,
    amount,
    tokenKind: (body.tokenKind as any) || 'AT', // eslint-disable-line @typescript-eslint/no-explicit-any
    reason: (body.reason as string) || undefined,
    ref: (body.ref as string) || undefined,
  })

  return Response.json(result, { status: result.ok ? 200 : 400 })
}
