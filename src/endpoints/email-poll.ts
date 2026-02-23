/**
 * Email Poll Endpoint — GET /api/email/poll
 *
 * Vercel Cron target (every 2 minutes): connects to SYSTEM_EMAIL_ADDRESS
 * via IMAP, fetches unseen messages, converts each into an AI Bus channel,
 * generates a LEO response, and replies to the sender via Resend.
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
 * Environment:
 *   SYSTEM_EMAIL_ADDRESS   — IMAP user + reply-from (hello@spacesangels.com)
 *   SYSTEM_EMAIL_PASSWORD  — IMAP password
 *   SYSTEM_EMAIL_NAME      — Display name in outbound replies (Angel OS)
 *   RESEND_API_KEY         — For sending LEO replies via Resend
 *   CRON_SECRET            — Shared secret authenticating cron calls
 *   DEFAULT_TENANT_SLUG    — Platform tenant slug (default: 'default')
 */

import type { PayloadHandler, Payload } from 'payload'
import { ImapFlow } from 'imapflow'
import { simpleParser, type ParsedMail } from 'mailparser'
import { Resend } from 'resend'

import { ensureDMSpace } from '@/utilities/ensureSystemSpace'
import { leoProcessMessage } from '@/utilities/leoProcessMessage'
import { wrapTextContent } from '@/utilities/messageContent'
import { logError } from '@/utilities/logError'

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

  const emailAddress = process.env.SYSTEM_EMAIL_ADDRESS
  const emailPassword = process.env.SYSTEM_EMAIL_PASSWORD
  const emailName = process.env.SYSTEM_EMAIL_NAME || 'Angel OS'

  if (!emailAddress || !emailPassword) {
    return Response.json(
      { message: 'SYSTEM_EMAIL_ADDRESS or SYSTEM_EMAIL_PASSWORD not configured' },
      { status: 500 },
    )
  }

  const payload = req.payload
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

  // ── Resolve platform tenant ────────────────────────────────────────────────
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
    // Non-critical — continue
  }

  if (!tenantId) {
    return Response.json({ message: 'No default tenant found — run seed first' }, { status: 404 })
  }

  // ── Ensure DM space exists for platform tenant ─────────────────────────────
  const dmSpaceId = await ensureDMSpace(tenantId)
  if (!dmSpaceId) {
    return Response.json(
      { message: 'Failed to ensure DM space for platform tenant' },
      { status: 500 },
    )
  }

  // ── IMAP connection ────────────────────────────────────────────────────────
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: emailAddress, pass: emailPassword },
    logger: false, // Suppress verbose IMAP protocol logs
  })

  const processed: Array<{ from: string; subject: string; channelSlug: string; replied: boolean }> =
    []
  const errors: string[] = []

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    try {
      // Search for unseen messages (returns uid numbers or false)
      const searchResult = await client.search({ seen: false }, { uid: true })
      const unseenUids: number[] = Array.isArray(searchResult) ? searchResult : []
      const toProcess = unseenUids.slice(0, MAX_EMAILS_PER_POLL)

      if (toProcess.length === 0) {
        return Response.json({ processed: 0, message: 'No new emails' })
      }

      for (const uid of toProcess) {
        try {
          // ── Fetch raw message ──────────────────────────────────────────────
          const msgData = await client.fetchOne(String(uid), { source: true }, { uid: true })
          // fetchOne returns false when the message doesn't exist
          if (!msgData || typeof msgData === 'boolean' || !('source' in msgData)) continue
          const rawSource = msgData.source
          if (!rawSource) continue

          // ── Parse email ────────────────────────────────────────────────────
          const parsed = await simpleParser(rawSource)

          const fromValue = Array.isArray(parsed.from?.value) ? parsed.from!.value[0] : null
          const fromAddress = fromValue?.address || 'unknown@unknown.com'
          const fromName = fromValue?.name || fromAddress
          const subject = parsed.subject || '(no subject)'

          // Prefer plain text; strip HTML as fallback
          const htmlText =
            typeof parsed.html === 'string'
              ? parsed.html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
              : ''
          const bodyText = (parsed.text?.trim() || htmlText).slice(0, 3000)

          // Skip self-emails (avoid reply loops)
          if (fromAddress.toLowerCase() === emailAddress.toLowerCase()) {
            await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true })
            continue
          }

          // Skip automated responses (OOO, no-reply, auto-responders) to prevent
          // LEO ↔ external-auto-responder infinite loops. Still mark as seen.
          if (isAutoReply(parsed)) {
            await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true })
            await logError({
              source: 'email-poll',
              message: `Skipped auto-reply from ${fromAddress} — subject: "${subject}"`,
              details: 'Detected as automated response; no LEO reply generated.',
            })
            continue
          }

          // ── Derive channel slug ────────────────────────────────────────────
          // Normalize to match Payload's slugField transformation:
          // @ → hyphen, everything non-alphanumeric removed, hyphens collapsed
          const sanitized = fromAddress
            .toLowerCase()
            .replace(/@/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
          const channelSlug = `email-${sanitized}`

          // ── Find or create email-sourced channel ───────────────────────────
          const { channelId: emailChannelId } = await findOrCreateEmailChannel(
            payload,
            tenantId,
            Number(dmSpaceId),
            channelSlug,
            fromName,
            fromAddress,
          )

          // ── Store inbound message ──────────────────────────────────────────
          const inboundBody = subject ? `📧 **${subject}**\n\n${bodyText}` : bodyText
          await payload.create({
            collection: 'messages',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- UMS content bypasses strict union
            data: {
              content: wrapTextContent(inboundBody),
              space: Number(dmSpaceId),
              channel: channelSlug,
              messageType: 'user',
              metadata: {
                source: 'email',
                fromAddress,
                fromName,
                subject,
                messageId: parsed.messageId,
              },
              tenant: tenantId,
            } as any,
            overrideAccess: true,
          })

          // ── Generate LEO reply ─────────────────────────────────────────────
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
              userContext: {
                id: `email-${sanitized}`,
                name: fromName,
                email: fromAddress,
              },
            })
            leoReply = result.text
          } catch (leoErr) {
            leoReply =
              `Thank you for reaching out! I've received your message and will follow up shortly.\n\n` +
              `— ${emailName}`
            await logError({
              source: 'email-poll',
              message: 'LEO response generation failed',
              details: leoErr instanceof Error ? leoErr.message : String(leoErr),
            })
          }

          // ── Store LEO reply as outbound AI message ─────────────────────────
          if (leoReply) {
            await payload.create({
              collection: 'messages',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data: {
                content: wrapTextContent(leoReply),
                space: Number(dmSpaceId),
                channel: channelSlug,
                messageType: 'ai_agent',
                metadata: {
                  source: 'email',
                  agentName: 'LEO',
                  replyTo: fromAddress,
                  subject: `Re: ${subject}`,
                },
                tenant: tenantId,
              } as any,
              overrideAccess: true,
            })
          }

          // ── Send reply via Resend ──────────────────────────────────────────
          let replied = false
          if (resend && leoReply) {
            try {
              await resend.emails.send({
                from: `${emailName} <${emailAddress}>`,
                to: [fromAddress],
                subject: `Re: ${subject}`,
                text: leoReply,
                replyTo: emailAddress,
              })
              replied = true
            } catch (sendErr) {
              await logError({
                source: 'email-poll',
                message: 'Resend reply failed',
                details: sendErr instanceof Error ? sendErr.message : String(sendErr),
              })
            }
          }

          // ── Mark as SEEN ───────────────────────────────────────────────────
          await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true })

          processed.push({ from: fromAddress, subject, channelSlug, replied })
        } catch (emailErr) {
          const msg = emailErr instanceof Error ? emailErr.message : String(emailErr)
          errors.push(msg)
          await logError({
            source: 'email-poll',
            message: 'Failed to process individual email',
            details: msg,
          })
        }
      }
    } finally {
      lock.release()
    }
  } catch (connectErr) {
    await logError({
      source: 'email-poll',
      message: 'IMAP connection failed',
      details: connectErr instanceof Error ? connectErr.message : String(connectErr),
    })
    return Response.json(
      {
        message: 'IMAP connection failed',
        error: connectErr instanceof Error ? connectErr.message : String(connectErr),
      },
      { status: 500 },
    )
  } finally {
    await client.logout().catch(() => {})
  }

  return Response.json({
    processed: processed.length,
    emails: processed,
    ...(errors.length > 0 && { errors }),
  })
}

// ─── Helper: find or create an email-sourced DM channel ──────────────────────

async function findOrCreateEmailChannel(
  payload: Payload,
  tenantId: number,
  dmSpaceId: number,
  slug: string,
  fromName: string,
  fromAddress: string,
): Promise<{ channelId: string; isNew: boolean }> {
  // Look up by slug + tenant only — source filter is omitted because Payload's
  // slugField transforms the slug (strips dots) before storing, so slug+tenant
  // is the canonical dedup key. Adding source would cause false misses.
  const existing = await payload.find({
    collection: 'channels',
    where: {
      and: [
        { slug: { equals: slug } },
        { tenant: { equals: tenantId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs?.[0]) {
    return { channelId: String(existing.docs[0].id), isNew: false }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channel = await payload.create({
    collection: 'channels',
    data: {
      name: `📧 ${fromName}`,
      slug,
      description: `Email thread with ${fromAddress}`,
      type: 'dm',
      space: dmSpaceId,
      source: 'email',
      isDefault: false,
      tenant: tenantId,
      members: [],
    } as any,
    overrideAccess: true,
  })

  return { channelId: String(channel.id), isNew: true }
}
