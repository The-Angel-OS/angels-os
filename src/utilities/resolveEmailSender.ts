/**
 * Email Outbound Connector Resolver
 *
 * Resolves the correct email transport for a given tenant using the Connectors
 * collection. This makes email outbound uniform with email inbound — both use
 * the same per-tenant, swappable, priority-ordered connector pattern.
 *
 * Resolution order:
 *   1. Connector: email_outbound for this tenant (database-driven, per-tenant)
 *   2. Payload default: payload.sendEmail() (boot-time adapter from config)
 *
 * Connector config format (JSON in Connectors.config field):
 *   {
 *     "provider": "resend" | "smtp",
 *     "fromAddress": "hello@example.com",
 *     "fromName": "My Enterprise",
 *     "apiKey": "re_xxx",               // Resend provider
 *     "smtpHost": "smtp.example.com",    // SMTP provider
 *     "smtpPort": 587,
 *     "smtpUser": "user",
 *     "smtpPass": "pass"
 *   }
 *
 * @see src/collections/Connectors/index.ts — schema
 * @see src/utilities/resolveConnector.ts — resolution logic
 * @see src/endpoints/email-poll.ts — inbound pattern (for reference)
 */
import type { Payload } from 'payload'

import { resolveConnector } from './resolveConnector'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmailMessage {
  to: string
  subject: string
  html?: string
  text?: string
  /** Override the "from" address for this specific email (e.g., email-poll replies) */
  from?: string
  /** Reply-to address */
  replyTo?: string
}

export interface ResolvedEmailSender {
  /** Send an email using the resolved transport */
  sendEmail: (message: EmailMessage) => Promise<void>
  /** The default from address for this sender */
  fromAddress: string
  /** The default from name for this sender */
  fromName: string
  /** Which provider resolved: 'resend', 'smtp', or 'payload-default' */
  provider: 'resend' | 'smtp' | 'payload-default'
  /** Connector ID if resolved from database (undefined for payload-default) */
  connectorId?: string
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolve the email outbound transport for a given tenant.
 *
 * Per-tenant, swappable, observable. Falls back gracefully to Payload's
 * boot-time adapter when no connector is configured.
 */
export async function resolveEmailSender(
  payload: Payload,
  tenantId?: number | string | null,
): Promise<ResolvedEmailSender> {
  // ── Step 1: Try connector-based resolution ──────────────────────────────
  if (tenantId) {
    try {
      const connector = await resolveConnector(payload, {
        type: 'email_outbound',
        tenantId,
      })

      if (connector) {
        const cfg = connector.config
        const fromAddress = String(cfg.fromAddress || cfg.emailAddress || '')
        const fromName = String(cfg.fromName || cfg.displayName || 'Angel OS')
        const provider = String(cfg.provider || '').toLowerCase()

        // ── Resend transport ──────────────────────────────────────────────
        if (provider === 'resend' && cfg.apiKey) {
          const { Resend } = await import('resend')
          const resend = new Resend(String(cfg.apiKey))

          return {
            sendEmail: async (msg) => {
              const fromLine = msg.from || `${fromName} <${fromAddress}>`
              // Build Resend-compatible options
              const opts: {
                from: string
                to: string[]
                subject: string
                html?: string
                text?: string
                replyTo?: string
              } = {
                from: fromLine,
                to: [msg.to],
                subject: msg.subject,
              }
              if (msg.html) opts.html = msg.html
              if (msg.text) opts.text = msg.text
              if (msg.replyTo) opts.replyTo = msg.replyTo
              await resend.emails.send(opts as any) // eslint-disable-line @typescript-eslint/no-explicit-any
              // Update connector activity on success
              await updateConnectorActivity(payload, connector.id).catch(() => {})
            },
            fromAddress,
            fromName,
            provider: 'resend',
            connectorId: connector.id,
          }
        }

        // ── SMTP transport ────────────────────────────────────────────────
        if (provider === 'smtp' && cfg.smtpHost) {
          // Dynamic require — nodemailer is a transitive dep of @payloadcms/email-nodemailer
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const nodemailer = require('nodemailer') as {
            createTransport: (opts: Record<string, unknown>) => {
              sendMail: (opts: Record<string, unknown>) => Promise<unknown>
            }
          }
          const transporter = nodemailer.createTransport({
            host: String(cfg.smtpHost),
            port: Number(cfg.smtpPort) || 587,
            secure: Number(cfg.smtpPort) === 465,
            auth: cfg.smtpUser
              ? { user: String(cfg.smtpUser), pass: String(cfg.smtpPass || '') }
              : undefined,
          })

          return {
            sendEmail: async (msg) => {
              await transporter.sendMail({
                from: msg.from || `"${fromName}" <${fromAddress}>`,
                to: msg.to,
                subject: msg.subject,
                html: msg.html || undefined,
                text: msg.text || undefined,
                ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
              })
              await updateConnectorActivity(payload, connector.id).catch(() => {})
            },
            fromAddress,
            fromName,
            provider: 'smtp',
            connectorId: connector.id,
          }
        }

        // Connector exists but provider not recognized — log and fall through
        console.warn(
          `[Email Outbound] Connector ${connector.id} has unrecognized provider "${provider}". Falling back to default.`,
        )
      }
    } catch (err) {
      // Connectors collection may not exist yet (pre-migration) — fall through
      console.warn(
        '[Email Outbound] Connector resolution failed, using default:',
        err instanceof Error ? err.message : err,
      )
    }
  }

  // ── Step 2: Fallback to Payload's boot-time adapter ─────────────────────
  return {
    sendEmail: async (msg) => {
      await payload.sendEmail({
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      })
    },
    fromAddress:
      process.env.SYSTEM_EMAIL_ADDRESS ||
      process.env.EMAIL_FROM_ADDRESS ||
      'hello@spacesangels.com',
    fromName: process.env.SYSTEM_EMAIL_NAME || process.env.EMAIL_FROM_NAME || 'Angel OS',
    provider: 'payload-default',
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Update connector lastActivity and status after a successful send.
 * Non-critical — failures are silently ignored.
 */
async function updateConnectorActivity(payload: Payload, connectorId: string): Promise<void> {
  await payload.update({
    collection: 'connectors' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    id: connectorId,
    data: {
      lastActivity: new Date().toISOString(),
      status: 'active',
      errorMessage: '',
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    overrideAccess: true,
  })
}

/**
 * Mark a connector as errored after a send failure.
 * Non-critical — failures are silently ignored.
 */
export async function markConnectorError(
  payload: Payload,
  connectorId: string,
  errorMessage: string,
): Promise<void> {
  try {
    await payload.update({
      collection: 'connectors' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      id: connectorId,
      data: {
        status: 'error',
        errorMessage: errorMessage.slice(0, 500),
        lastActivity: new Date().toISOString(),
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      overrideAccess: true,
    })
  } catch {
    // Non-critical
  }
}
