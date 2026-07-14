/**
 * POST /api/auth/verify-otp
 *
 * Passwordless login — step 2. Body: { email, code }. On a correct, unexpired,
 * non-exhausted code: find-or-create the user, mint a Payload session, and return
 * { token, user, isNew }. One generic error for every failure (no oracle).
 */
import type { PayloadHandler } from 'payload'
import { verifyOtp } from '@/utilities/otpLogin'
import { applyRateLimit } from '@/utilities/apiRateLimiter'

export const authVerifyOtpHandler: PayloadHandler = async (req) => {
  if ((req.method || (req as unknown as Request).method)?.toUpperCase() !== 'POST') {
    return Response.json({ message: 'Method not allowed' }, { status: 405 })
  }

  const rateLimited = applyRateLimit(req, 'invitations')
  if (rateLimited) return rateLimited

  let body: Record<string, unknown>
  try {
    body = (req.data as Record<string, unknown>) ?? (await (req as unknown as Request).json())
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const email = typeof body?.email === 'string' ? body.email : ''
  const code = typeof body?.code === 'string' ? body.code : String(body?.code ?? '')
  const result = await verifyOtp(req.payload, email, code)
  if (!result.ok) return Response.json({ message: result.error || 'Invalid code' }, { status: 400 })

  return Response.json({
    token: result.token,
    user: { id: result.user.id, email: result.user.email, name: result.user.name },
    isNew: result.isNew,
  })
}
