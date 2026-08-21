/**
 * Prospect intake — POST /api/provision-ops/prospect-intake
 *
 * The LEO tool `intake_prospect` is the front door; this is the same call for a
 * script or a form. Body mirrors demo-site plus contactName / adText / adUrl.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Same reasoning as demo-site — one
 * call provisions a tenant and mints an admin invite.
 */
import type { PayloadHandler } from 'payload'
import { prospectIntake } from '@/utilities/prospectIntake'

export const prospectIntakeHandler: PayloadHandler = async (req) => {
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
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const str = (v: unknown): string | undefined => {
    const t = typeof v === 'string' ? v.trim() : ''
    return t ? t.slice(0, 200) : undefined
  }

  const businessName = str(body.businessName)
  if (!businessName) return Response.json({ error: 'businessName is required' }, { status: 400 })

  const result = await prospectIntake(
    payload,
    {
      businessName,
      trade: str(body.trade),
      city: str(body.city),
      phone: str(body.phone),
      email: str(body.email),
      contactName: str(body.contactName),
      // Not truncated at 200 — the ad IS the context.
      adText: typeof body.adText === 'string' ? body.adText : undefined,
      adUrl: str(body.adUrl),
      slug: str(body.slug)?.toLowerCase(),
      generateHero: body.generateHero === true,
      invitedBy: user?.id,
    },
    { req },
  )

  return result.ok ? Response.json(result) : Response.json(result, { status: 500 })
}
