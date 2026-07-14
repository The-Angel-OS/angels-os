/**
 * Passwordless email-OTP login.
 *
 * request → we email a 6-digit code (hashed at rest, short-lived) to the address.
 * verify  → the code proves control of the inbox; we find-or-create the user and
 *           mint a session (same guardian-angel onboarding floor as Google login).
 *
 * No Google account required — the universal entry the Play Store / non-Google
 * users need (the Shop.app OTP model). Codes live in the Settings bag (durable,
 * no new collection/migration) under a platform-tenant scope; hashed with the
 * server secret so a DB leak never reveals a live code.
 *
 * Privacy: request ALWAYS reports success (never leak whether an email exists);
 * verify returns one generic error for wrong/expired/exhausted so it can't be
 * used as an oracle.
 */
import type { Payload } from 'payload'
import crypto from 'crypto'
import { getJsonSetting, setJsonSetting, deleteSetting } from '@/services/SettingService'
import { resolveEmailSender } from '@/utilities/resolveEmailSender'
import { mintSessionToken } from '@/utilities/mintSession'

const CODE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_ATTEMPTS = 5
const SETTING_NAME = 'login_otp'

interface OtpRecord {
  codeHash: string
  expiresAt: number
  attempts: number
  email: string
}

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** A stable, filesystem/URL-safe key for the email (settings entityId). */
function emailKey(email: string): string {
  return crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex').slice(0, 32)
}

function hashCode(code: string, email: string, secret: string): string {
  return crypto.createHash('sha256').update(`${code}:${normalizeEmail(email)}:${secret}`).digest('hex')
}

/** Constant-time compare of two equal-length hex hashes. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

// Resolve a platform tenant to scope the OTP settings under (cached per lambda).
let _platformTenantId: number | null = null
async function platformTenantId(payload: Payload): Promise<number> {
  if (_platformTenantId != null) return _platformTenantId
  try {
    const bySlug = await payload.find({
      collection: 'tenants',
      where: { slug: { in: ['default', 'platform', 'kendev'] } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const id = bySlug.docs[0]?.id
    if (typeof id === 'number') return (_platformTenantId = id)
  } catch {
    /* fall through */
  }
  const first = await payload.find({ collection: 'tenants', limit: 1, sort: 'createdAt', depth: 0, overrideAccess: true })
  const id = first.docs[0]?.id
  if (typeof id !== 'number') throw new Error('no tenant to scope OTP under')
  return (_platformTenantId = id)
}

function otpScope(tenantId: number, email: string) {
  return { entityName: 'otp', entityId: emailKey(email), tenantId }
}

function otpEmailHtml(code: string): { subject: string; html: string; text: string } {
  const subject = `${code} is your Angel OS sign-in code`
  const text = `Your sign-in code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`
  const html = `<!doctype html><html><body style="margin:0;background:#0a0a14;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#e8e8f0;padding:32px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="420" cellpadding="0" cellspacing="0" style="max-width:420px;background:linear-gradient(180deg,#11112288,#0a0a14);border:1px solid #2a2a44;border-radius:16px;padding:28px">
      <tr><td style="font-size:12px;letter-spacing:.18em;color:#f5a623;text-transform:uppercase;font-weight:700">The Angel OS</td></tr>
      <tr><td style="padding-top:14px;font-size:15px;color:#cdd6f4">Here's your sign-in code:</td></tr>
      <tr><td style="padding:18px 0"><div style="font-size:38px;letter-spacing:.28em;font-weight:800;color:#99ccff">${code}</div></td></tr>
      <tr><td style="font-size:13px;color:#9aa0b4;line-height:1.5">It expires in 10 minutes. Enter it in the app to sign in.<br/>If you didn't request this, you can safely ignore this email.</td></tr>
    </table>
  </td></tr></table></body></html>`
  return { subject, html, text }
}

export interface RequestOtpResult {
  ok: boolean
  /** Only populated when EMAIL delivery has no configured provider (dev) — never in prod. */
  devCode?: string
  error?: string
}

/**
 * Generate + store + email a login code. Always resolves `{ ok: true }` for a
 * valid-looking email (no existence oracle); only a malformed email is rejected.
 */
export async function requestOtp(payload: Payload, emailRaw: string): Promise<RequestOtpResult> {
  const email = normalizeEmail(emailRaw)
  if (!isValidEmail(email)) return { ok: false, error: 'Enter a valid email address.' }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  const tenantId = await platformTenantId(payload)
  const record: OtpRecord = {
    codeHash: hashCode(code, email, payload.secret),
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
    email,
  }
  await setJsonSetting(payload, otpScope(tenantId, email), SETTING_NAME, record, { isPrivate: true })

  // No real transport configured (dev): 'payload-default' with neither Resend nor
  // SMTP env means payload.sendEmail only logs. Surface the code so DEV can sign
  // in — but NEVER in production (that would be an open door).
  const noRealProvider = !process.env.RESEND_API_KEY && !process.env.SMTP_HOST
  const isDev = process.env.NODE_ENV !== 'production'

  const { subject, html, text } = otpEmailHtml(code)
  try {
    const sender = await resolveEmailSender(payload, undefined)
    await sender.sendEmail({ to: email, subject, html, text })
    if (sender.provider === 'payload-default' && noRealProvider && isDev) {
      payload.logger?.warn?.(`[otpLogin] no email provider — dev code for ${email}: ${code}`)
      return { ok: true, devCode: code }
    }
  } catch (err) {
    payload.logger?.warn?.(`[otpLogin] send failed: ${err instanceof Error ? err.message : String(err)}`)
    if (noRealProvider && isDev) return { ok: true, devCode: code }
    // Still ok:true — don't leak send failures to the caller as an existence signal.
  }
  return { ok: true }
}

export interface VerifyOtpResult {
  ok: boolean
  token?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user?: any
  isNew?: boolean
  error?: string
}

const GENERIC_FAIL = 'That code is invalid or has expired. Request a new one.'

/**
 * Verify a code and, on success, find-or-create the user and mint a session.
 * Onboarding parity with Google login (guardian-angel floor). One generic error
 * for every failure mode so it can't be probed.
 */
export async function verifyOtp(payload: Payload, emailRaw: string, codeRaw: string): Promise<VerifyOtpResult> {
  const email = normalizeEmail(emailRaw)
  const code = String(codeRaw || '').trim()
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) return { ok: false, error: GENERIC_FAIL }

  const tenantId = await platformTenantId(payload)
  const scope = otpScope(tenantId, email)
  const record = await getJsonSetting<OtpRecord>(payload, scope, SETTING_NAME)
  if (!record) return { ok: false, error: GENERIC_FAIL }

  if (Date.now() > record.expiresAt || record.attempts >= MAX_ATTEMPTS) {
    await deleteSetting(payload, scope, SETTING_NAME)
    return { ok: false, error: GENERIC_FAIL }
  }

  const matches = safeEqual(record.codeHash, hashCode(code, email, payload.secret))
  if (!matches) {
    await setJsonSetting(payload, scope, SETTING_NAME, { ...record, attempts: record.attempts + 1 }, { isPrivate: true })
    return { ok: false, error: GENERIC_FAIL }
  }

  // Success — burn the code immediately (single use).
  await deleteSetting(payload, scope, SETTING_NAME)

  // Find-or-create the user (mirrors googleIdentity's find-or-create).
  const existing = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, overrideAccess: true })
  let user = existing.docs[0]
  const isNew = !user
  if (!user) {
    user = await payload.create({
      collection: 'users',
      data: {
        email,
        name: '',
        password: crypto.randomUUID() + crypto.randomUUID(),
        roles: ['customer'],
      } as never,
      overrideAccess: true,
    })
  }

  const minted = await mintSessionToken(payload, user as { id: number; email: string; sessions?: unknown[] })

  // Onboarding floor: every person gets their guardian-angel portal (idempotent,
  // fail-soft — a provisioning hiccup never blocks sign-in). Same as Google login.
  try {
    const { ensureGuardianAngel } = await import('@/utilities/ensureGuardianAngel')
    await ensureGuardianAngel(payload, { id: (user as { id: number }).id, email: (user as { email: string }).email, name: (user as { name?: string }).name })
  } catch (gaErr) {
    payload.logger?.warn?.(`[otpLogin] guardian-angel ensure failed: ${gaErr instanceof Error ? gaErr.message : gaErr}`)
  }

  return { ok: true, token: minted.token, user, isNew }
}
