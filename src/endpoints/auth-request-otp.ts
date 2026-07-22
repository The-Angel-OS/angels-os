/**
 * POST /api/auth/request-otp
 *
 * Passwordless login — step 1. Body: { email }. Emails a 6-digit code and always
 * responds { ok: true } for a valid-looking address (no existence oracle). In DEV
 * with no email provider configured, echoes { devCode } so local sign-in works.
 */
import type { PayloadHandler } from 'payload'
import { requestOtp, requestOtpSms } from '@/utilities/otpLogin'
import { applyRateLimit } from '@/utilities/apiRateLimiter'

export const authRequestOtpHandler: PayloadHandler = async (req) => {
  if ((req.method || (req as unknown as Request).method)?.toUpperCase() !== 'POST') {
    return Response.json({ message: 'Method not allowed' }, { status: 405 })
  }

  const rateLimited = applyRateLimit(req, 'registration')
  if (rateLimited) return rateLimited

  let body: Record<string, unknown>
  try {
    body = (req.data as Record<string, unknown>) ?? (await (req as unknown as Request).json())
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const email = typeof body?.email === 'string' ? body.email : ''
  const phone = typeof body?.phone === 'string' ? body.phone : ''
  // Phone → text the code via Twilio Verify; email → the original emailed code.
  const result = phone ? await requestOtpSms(req.payload, phone) : await requestOtp(req.payload, email)
  if (!result.ok) return Response.json({ message: result.error || 'Invalid request' }, { status: 400 })

  return Response.json({ ok: true, ...(result.devCode ? { devCode: result.devCode } : {}) })
}
