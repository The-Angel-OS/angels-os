/**
 * Email Poll Endpoint — GET /api/email/poll
 *
 * Vercel Cron target (every 2 minutes): connects to SYSTEM_EMAIL_ADDRESS
 * via IMAP, fetches unseen messages, converts each into an AI Bus channel,
 * generates a LEO response, and replies to the sender via Resend.
 *
 * Connector-aware (both directions):
 *   Inbound:  email_inbound Connectors → IMAP sources per tenant
 *   Outbound: email_outbound Connectors → per-tenant reply transport (Resend/SMTP)
 *
 * Falls back to environment variables for backwards compatibility.
 *
 * Channel per sender:
 *   slug: email-{sanitized-sender-address}
 *   type: dm  |  source: email
 *   space: DM system space for the platform tenant
 *
 * Security: Protected by Authorization: Bearer CRON_SECRET.
 * Vercel Cron automatically injects this header in production.
 * For local testing: pass the same header manually.
 *
 * Environment (legacy fallback):
 *   SYSTEM_EMAIL_ADDRESS   — IMAP user + reply-from (hello@spacesangels.com)
 *   SYSTEM_EMAIL_PASSWORD  — IMAP password
 *   SYSTEM_EMAIL_NAME      — Display name in outbound replies (Angel OS)
 *   CRON_SECRET            — Shared secret authenticating cron calls
 *   DEFAULT_TENANT_SLUG    — Platform tenant slug (default: 'default')
 */

import type { PayloadHandler } from 'payload'
import { ImapFlow } from 'imapflow'
import { simpleParser, type ParsedMail } from 'mailparser'

import { ensureDMSpace } from '@/utilities/ensureSystemSpace'
import { leoProcessMessage } from '@/utilities/leoProcessMessage'
import { wrapTextContent } from '@/utilities/messageContent'
import { logError } from '@/utilities/logError'
import { findAllConnectors } from '@/utilities/resolveConnector'
import { resolveEmailSender } from '@/utilities/resolveEmailSender'
import { findOrCreateBridgeChannel, markConnectorActive } from '@/utilities/bridgeHelpers'

// ─── Config ──────────────────────────────────────────────────────────────────

const IMAP_HOST = 'imap.ionos.com'

// ─── Auto-reply detection (RFC 3834 + heuristics) ───────────────────────────

/**
 * Returns true if the parsed email appears to be an automated response.
 * We skip LEO processing and Resend replies for auto-replies to prevent
 * infinite loops (e.g. LEO replies → external auto-responder → LEO replies …).
 */
function isAutoReply(parsed: ParsedMail): boolean {
  const get = (h: string) => {
    const v = parsed.headers.get(h)
    return v ? String(v).toLowerCase() : ''
  }

  // RFC 3834 — the canonical header for automated responses
  const autoSubmitted = get('auto-submitted')
  if (autoSubmitted && autoSubmitted !== 'no') return true

  // Microsoft Exchange / Outlook suppress flag
  if (get('x-auto-response-suppress')) return true

  // Common vacation / OOO headers
  if (get('x-autoreply') || get('x-autorespond') || get('x-vacation-autorespond')) return true

  // Precedence: bulk / junk / list (mass mailers, mailing lists)
  const precedence = get('precedence')
  if (['bulk', 'junk', 'list'].includes(precedence)) return true

  // From address patterns that indicate no human sender
  const fromAddr = (parsed.from?.value?.[0]?.address || '').toLowerCase()
  const noReplyPatterns = ['noreply', 'no-reply', 'donotreply', 'do-not-reply', 'mailer-daemon', 'postmaster', 'bounce', 'devnull', 'null@', 'nobody@']
  if (noReplyPatterns.some((p) => fromAddr.includes(p))) return true

  // Subject line patterns that indicate auto-generated email
  const subject = (parsed.subject || '').toLowerCase()
  const autoSubjectPrefixes = ['out of office', 'automatic reply', 'auto reply', 'auto-reply', 'autoreply', 'delivery failure', 'undeliverable', 'mail delivery', 'returned mail', 'delivery status']
  if (autoSubjectPrefixes.some((p) => subject.startsWith(p))) return true

  return false
}
const IMAP_PORT = 993
const MAX_EMAILS_PER_POLL = 10 // Guard against inbox burst

// ─── Handler ─────────────────────────────────────────────────────────────────

export const emailPollHandler: PayloadHandler = async (req) => {
  // ── Auth: Vercel Cron injects `Authorization: Bearer <CRON_SECRET>` ────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }
  }

  const payload = req.payload

  // ── Build list of email accounts to poll ─────────────────────────────────
  // Priority 1: Connectors collection (Endeavor-level config)
  // Priority 2: Environment variables (backwards compatibility)
  interface EmailSource {
    emailAddress: string
    emailPassword: string
    emailName: string
    imapHost: string
    imapPort: number
    tenantId: number
    connectorId?: string
  }

  const emailSources: EmailSource[] = []
  let connectorLookupError: string | undefined

  // Check for Connectors-based email_inbound configs
  try {
    const connectors = await findAllConnectors(payload, 'email_inbound')
    for (const conn of connectors) {
      const cfg = conn.config as Record<string, unknown>
      if (cfg.emailAddress && cfg.password) {
        emailSources.push({
          emailAddress: String(cfg.emailAddress),
          emailPassword: String(cfg.password),
          emailName: String(cfg.displayName || cfg.emailAddress),
          imapHost: String(cfg.imapHost || IMAP_HOST),
          imapPort: Number(cfg.imapPort || IMAP_PORT),
          tenantId: Number(conn.tenantId),
          connectorId: conn.id,
        })
      }
    }
  } catch (err) {
    // Connectors collection may not exist yet (pre-migration) — continue to env
    // fallback, but SAY so. Swallowing this silently is how a broken lookup
    // becomes indistinguishable from an empty inbox.
    connectorLookupError = err instanceof Error ? err.message : String(err)
  }

  // Fallback: environment variables (legacy path)
  if (emailSources.length === 0) {
    const emailAddress = process.env.SYSTEM_EMAIL_ADDRESS
    const emailPassword = process.env.SYSTEM_EMAIL_PASSWORD
    const emailName = process.env.SYSTEM_EMAIL_NAME || 'Angel OS'

    if (!emailAddress || !emailPassword) {
      // NOT a 500. Nobody has configured inbound email — that is a state, not a
      // failure, and dressing it as a server error is why this endpoint looked
      // broken for weeks while it was only unconfigured. (260731)
      return Response.json({
        processed: 0,
        sources: 0,
        configured: false,
        message:
          'Inbound email is not configured: no email_inbound connector, and SYSTEM_EMAIL_ADDRESS/SYSTEM_EMAIL_PASSWORD are not both set.',
        ...(connectorLookupError && { connectorLookupError }),
      })
    }

    // Resolve platform tenant for legacy path
    let tenantId: number | undefined
    try {
      const tenantSlug = process.env.DEFAULT_TENANT_SLUG || 'default'
      const tenants = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: tenantSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      tenantId = tenants.docs?.[0]?.id
    } catch {
      // Non-critical
    }

    if (!tenantId) {
      return Response.json({ message: 'No default tenant found — run seed first' }, { status: 404 })
    }

    emailSources.push({
      emailAddress,
      emailPassword,
      emailName,
      imapHost: IMAP_HOST,
      imapPort: IMAP_PORT,
      tenantId,
    })
  }

  // ── Poll each email source ───────────────────────────────────────────────
  const allProcessed: Array<{ from: string; subject: string; channelSlug: string; replied: boolean; source: string }> = []
  const allErrors: string[] = []

  for (const source of emailSources) {
    const { emailAddress, emailPassword, emailName, imapHost, imapPort, tenantId } = source

    // Ensure DM space exists for this tenant
    const dmSpaceId = await ensureDMSpace(tenantId)
    if (!dmSpaceId) {
      allErrors.push(`Failed to ensure DM space for tenant ${tenantId}`)
      continue
    }

    // IMAP connection for this source
    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: true,
      auth: { user: emailAddress, pass: emailPassword },
      logger: false,
    })

    const processed: Array<{ from: string; subject: string; channelSlug: string; replied: boolean }> = []
    const errors: string[] = []

    try {
      await client.connect()
      const lock = await client.getMailboxLock('INBOX')

      try {
        const searchResult = await client.search({ seen: false }, { uid: true })
        const unseenUids: number[] = Array.isArray(searchResult) ? searchResult : []
        const toProcess = unseenUids.slice(0, MAX_EMAILS_PER_POLL)

        for (const uid of toProcess) {
          try {
            const msgData = await client.fetchOne(String(uid), { source: true }, { uid: true })
            if (!msgData || typeof msgData === 'boolean' || !('source' in msgData)) continue
            const rawSource = msgData.source
            if (!rawSource) continue

            const parsed = await simpleParser(rawSource)

            const fromValue = Array.isArray(parsed.from?.value) ? parsed.from!.value[0] : null
            const fromAddress = fromValue?.address || 'unknown@unknown.com'
            const fromName = fromValue?.name || fromAddress
            const subject = parsed.subject || '(no subject)'

            const htmlText =
              typeof parsed.html === 'string'
                ? parsed.html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
                : ''
            const bodyText = (parsed.text?.trim() || htmlText).slice(0, 3000)

            if (fromAddress.toLowerCase() === emailAddress.toLowerCase()) {
              await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true })
              continue
            }

            if (isAutoReply(parsed)) {
              await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true })
              await logError({
                source: 'email-poll',
                message: `Skipped auto-reply from ${fromAddress} — subject: "${subject}"`,
                details: 'Detected as automated response; no LEO reply generated.',
              })
              continue
            }

            const sanitized = fromAddress
              .toLowerCase()
              .replace(/@/g, '-')
              .replace(/[^a-z0-9-]/g, '')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '')
            const channelSlug = `email-${sanitized}`

            await findOrCreateBridgeChannel(payload, {
              tenantId,
              dmSpaceId: Number(dmSpaceId),
              slug: channelSlug,
              displayName: fromName,
              source: 'email',
              description: `Email thread with ${fromAddress}`,
            })

            const inboundBody = subject ? `\uD83D\uDCE7 **${subject}**\n\n${bodyText}` : bodyText
            await payload.create({
              collection: 'messages',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data: {
                content: wrapTextContent(inboundBody),
                space: Number(dmSpaceId),
                channel: channelSlug,
                messageType: 'user',
                metadata: { source: 'email', fromAddress, fromName, subject, messageId: parsed.messageId },
                tenant: tenantId,
              } as any,
              overrideAccess: true,
            })

            let leoReply = ''
            try {
              const leoInput =
                `Email from ${fromName} <${fromAddress}>\nSubject: ${subject}\n\n` +
                bodyText.slice(0, 1500)

              const result = await leoProcessMessage({
                message: leoInput,
                tenantId,
                channelSlug,
                spaceId: Number(dmSpaceId),
                payload,
                userContext: { id: `email-${sanitized}`, name: fromName, email: fromAddress },
              })
              leoReply = result.text
            } catch (leoErr) {
              leoReply =
                `Thank you for reaching out! I've received your message and will follow up shortly.\n\n` +
                `\u2014 ${emailName}`
              await logError({
                source: 'email-poll',
                message: 'LEO response generation failed',
                details: leoErr instanceof Error ? leoErr.message : String(leoErr),
              })
            }

            if (leoReply) {
              await payload.create({
                collection: 'messages',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: {
                  content: wrapTextContent(leoReply),
                  space: Number(dmSpaceId),
                  channel: channelSlug,
                  messageType: 'ai_agent',
                  metadata: { source: 'email', agentName: 'LEO', replyTo: fromAddress, subject: `Re: ${subject}` },
                  tenant: tenantId,
                } as any,
                overrideAccess: true,
              })
            }

            let replied = false
            if (leoReply) {
              try {
                // Resolve email outbound via Connectors pattern (per-tenant, swappable)
                const sender = await resolveEmailSender(payload, tenantId)
                await sender.sendEmail({
                  to: fromAddress,
                  subject: `Re: ${subject}`,
                  text: leoReply,
                  from: `${emailName} <${emailAddress}>`,
                  replyTo: emailAddress,
                })
                replied = true
              } catch (sendErr) {
                await logError({
                  source: 'email-poll',
                  message: 'Email reply failed',
                  details: sendErr instanceof Error ? sendErr.message : String(sendErr),
                })
              }
            }

            await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true })
            processed.push({ from: fromAddress, subject, channelSlug, replied })
          } catch (emailErr) {
            const msg = emailErr instanceof Error ? emailErr.message : String(emailErr)
            errors.push(msg)
            await logError({ source: 'email-poll', message: 'Failed to process individual email', details: msg })
          }
        }
      } finally {
        lock.release()
      }
    } catch (connectErr) {
      const msg = connectErr instanceof Error ? connectErr.message : String(connectErr)
      allErrors.push(`IMAP ${emailAddress}: ${msg}`)
      await logError({ source: 'email-poll', message: `IMAP connection failed for ${emailAddress}`, details: msg })
    } finally {
      await client.logout().catch(() => {})
    }

    // Update connector lastActivity on success (shared helper)
    if (source.connectorId && processed.length > 0) {
      await markConnectorActive(payload, source.connectorId)
    }

    allProcessed.push(...processed.map((p) => ({ ...p, source: emailAddress })))
    allErrors.push(...errors)
  }

  return Response.json({
    processed: allProcessed.length,
    sources: emailSources.length,
    configured: true,
    emails: allProcessed,
    ...(allErrors.length > 0 && { errors: allErrors }),
    ...(connectorLookupError && { connectorLookupError }),
  })
}

