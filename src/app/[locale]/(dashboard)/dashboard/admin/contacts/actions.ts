'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { parseCSV, parseJSON } from '@/utilities/csvParser'
import {
  generateInvitationToken,
  calculateExpiration,
  isValidEmail,
} from '@/utilities/invitationSystem'
import { sendTenantInvitationEmail } from '@/utilities/sendTenantInvitationEmail'
import { resolveEmailSender } from '@/utilities/resolveEmailSender'
import { getServerSideURL } from '@/utilities/getURL'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ImportResult {
  success: boolean
  created: number
  skipped: number
  errors: string[]
  error?: string
}

export interface ContactRecord {
  id: string | number
  email: string
  name: string | null
  source: string
  sourceId: string | null
  tags: string[]
  contactStatus: string
  inviteStatus: string
  lastInvitedAt: string | null
  inviteCount: number
  createdAt: string
}

export interface ContactsResult {
  success: boolean
  contacts: ContactRecord[]
  totalDocs: number
  totalPages: number
  page: number
  error?: string
}

export interface ContactStats {
  total: number
  notInvited: number
  invited: number
  pending: number
  accepted: number
  bounced: number
}

export interface BulkInviteResult {
  success: boolean
  invited: number
  skipped: number
  failed: number
  errors: string[]
  error?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthenticatedAdmin() {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    return { payload, user: null, tenantId: null, error: 'Not authenticated' }
  }

  const isAdmin = checkRole(ADMIN_ROLES, user)

  if (!isAdmin) {
    return { payload, user, tenantId: null, error: 'Insufficient permissions' }
  }

  // Resolve tenant the SAME way the dashboard layout does (x-tenant-id → domain →
  // DEFAULT_TENANT_SLUG). The previous `x-tenant-id || 'default'` lacked the
  // domain fallback, so on an apex/federation host (no subdomain header, e.g.
  // federation.kendev.co) it looked up a non-existent 'default' tenant →
  // "Tenant not found" on the Contacts importer.
  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) {
    return { payload, user, tenantId: null, error: 'Tenant not found' }
  }

  return { payload, user, tenantId, error: null }
}

// ── Import Contacts ──────────────────────────────────────────────────────────

export async function importContacts(
  data: string,
  format: 'csv' | 'json',
  source: string,
  tags?: string[],
): Promise<ImportResult> {
  const { payload, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId) {
    return { success: false, created: 0, skipped: 0, errors: [], error: error || 'No tenant' }
  }

  // Parse the input
  const result = format === 'csv' ? parseCSV(data) : parseJSON(data)

  if (result.contacts.length === 0) {
    return {
      success: false,
      created: 0,
      skipped: 0,
      errors: result.errors.length > 0 ? result.errors : ['No valid contacts found'],
    }
  }

  let created = 0
  let skipped = 0
  const errors: string[] = [...result.errors]

  // Process contacts in batches
  for (const contact of result.contacts) {
    try {
      // Check for existing contact with same email + tenant
      const existing = await payload.find({
        collection: 'contacts',
        where: {
          and: [
            { email: { equals: contact.email } },
            { tenant: { equals: tenantId } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (existing.docs.length > 0) {
        skipped++
        continue
      }

      await payload.create({
        collection: 'contacts',
        data: {
          email: contact.email,
          name: contact.name || null,
          source,
          sourceId: contact.sourceId || null,
          tags: tags || [],
          contactStatus: 'lead',
          inviteStatus: 'not-invited',
          inviteCount: 0,
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })

      created++
    } catch (err) {
      errors.push(`${contact.email}: ${err instanceof Error ? err.message : 'failed'}`)
    }
  }

  return {
    success: true,
    created,
    skipped,
    errors: errors.slice(0, 50), // Cap error list
  }
}

// ── Get Contacts ─────────────────────────────────────────────────────────────

export async function getContacts(filters?: {
  search?: string
  source?: string
  contactStatus?: string
  inviteStatus?: string
  page?: number
  limit?: number
}): Promise<ContactsResult> {
  const { payload, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId) {
    return {
      success: false,
      contacts: [],
      totalDocs: 0,
      totalPages: 0,
      page: 1,
      error: error || 'No tenant',
    }
  }

  const where: any[] = [{ tenant: { equals: tenantId } }]

  if (filters?.search) {
    where.push({
      or: [
        { email: { contains: filters.search.toLowerCase() } },
        { name: { contains: filters.search } },
      ],
    })
  }
  if (filters?.source) {
    where.push({ source: { equals: filters.source } })
  }
  if (filters?.contactStatus) {
    where.push({ contactStatus: { equals: filters.contactStatus } })
  }
  if (filters?.inviteStatus) {
    where.push({ inviteStatus: { equals: filters.inviteStatus } })
  }

  const page = filters?.page || 1
  const limit = filters?.limit || 50

  const result = await payload.find({
    collection: 'contacts',
    where: { and: where },
    page,
    limit,
    sort: '-createdAt',
    depth: 0,
    overrideAccess: true,
  })

  const contacts: ContactRecord[] = result.docs.map((doc: any) => ({
    id: doc.id,
    email: doc.email,
    name: doc.name || null,
    source: doc.source || 'manual',
    sourceId: doc.sourceId || null,
    tags: doc.tags || [],
    contactStatus: doc.contactStatus || 'lead',
    inviteStatus: doc.inviteStatus || 'not-invited',
    lastInvitedAt: doc.lastInvitedAt || null,
    inviteCount: doc.inviteCount || 0,
    createdAt: doc.createdAt,
  }))

  return {
    success: true,
    contacts,
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    page: result.page ?? 1,
  }
}

// ── Get Contact Stats ────────────────────────────────────────────────────────

export async function getContactStats(): Promise<ContactStats> {
  const { payload, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId) {
    return { total: 0, notInvited: 0, invited: 0, pending: 0, accepted: 0, bounced: 0 }
  }

  const tenantFilter = { tenant: { equals: tenantId } }

  const [total, notInvited, pending, accepted, bounced] = await Promise.all([
    payload.count({ collection: 'contacts', where: tenantFilter, overrideAccess: true }),
    payload.count({
      collection: 'contacts',
      where: { and: [tenantFilter, { inviteStatus: { equals: 'not-invited' } }] },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'contacts',
      where: { and: [tenantFilter, { inviteStatus: { equals: 'pending' } }] },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'contacts',
      where: { and: [tenantFilter, { inviteStatus: { equals: 'accepted' } }] },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'contacts',
      where: { and: [tenantFilter, { contactStatus: { equals: 'bounced' } }] },
      overrideAccess: true,
    }),
  ])

  return {
    total: total.totalDocs,
    notInvited: notInvited.totalDocs,
    invited: total.totalDocs - notInvited.totalDocs,
    pending: pending.totalDocs,
    accepted: accepted.totalDocs,
    bounced: bounced.totalDocs,
  }
}

// ── Bulk Invite ──────────────────────────────────────────────────────────────

export async function bulkInvite(options: {
  contactIds?: (string | number)[]
  inviteStatus?: string
  role?: string
  message?: string
}): Promise<BulkInviteResult> {
  const { payload, user, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId || !user) {
    return {
      success: false,
      invited: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      error: error || 'No tenant or user',
    }
  }

  // Resolve contacts to invite
  let contacts: any[]
  if (options.contactIds && options.contactIds.length > 0) {
    // Explicit selection
    const result = await payload.find({
      collection: 'contacts',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { id: { in: options.contactIds } },
        ],
      },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    })
    contacts = result.docs
  } else {
    // Filter-based: invite all not-yet-invited contacts
    const statusFilter = options.inviteStatus || 'not-invited'
    const result = await payload.find({
      collection: 'contacts',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { inviteStatus: { equals: statusFilter } },
        ],
      },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    })
    contacts = result.docs
  }

  if (contacts.length === 0) {
    return { success: true, invited: 0, skipped: 0, failed: 0, errors: ['No contacts to invite'] }
  }

  // Fetch tenant name for email template
  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })
  const enterpriseName = (tenant as any)?.branding?.siteName || (tenant as any)?.name || 'Angel OS'
  const inviterName = (user as any).name || (user as any).email || 'An admin'
  const role = options.role || 'tenant_member'

  let invited = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []

  // Process in batches of 10
  const BATCH_SIZE = 10
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE)

    for (const contact of batch) {
      const email = (contact.email as string).toLowerCase()

      try {
        // Skip if already invited (pending or accepted)
        if (contact.inviteStatus === 'pending' || contact.inviteStatus === 'accepted') {
          skipped++
          continue
        }

        // Check if TenantMembership already exists for this email
        const existingUsers = await payload.find({
          collection: 'users',
          where: { email: { equals: email } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        const existingUserId = existingUsers.docs[0]?.id

        if (existingUserId) {
          const existingMembership = await payload.find({
            collection: 'tenant-memberships',
            where: {
              and: [
                { user: { equals: existingUserId } },
                { tenant: { equals: tenantId } },
                { status: { in: ['active', 'pending'] } },
              ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })

          if (existingMembership.docs.length > 0) {
            skipped++
            // Update contact status to reflect their existing membership
            await payload.update({
              collection: 'contacts',
              id: contact.id,
              data: {
                inviteStatus:
                  (existingMembership.docs[0] as any).status === 'active' ? 'accepted' : 'pending',
                contactStatus:
                  (existingMembership.docs[0] as any).status === 'active' ? 'accepted' : 'invited',
              },
              overrideAccess: true,
            })
            continue
          }
        }

        // Generate invitation
        const token = generateInvitationToken()
        const expiresAt = calculateExpiration(7)
        const inviteUrl = `/tenant-invite/${token}`

        // Create TenantMembership record
        await payload.create({
          collection: 'tenant-memberships',
          data: {
            user: existingUserId || user.id, // placeholder if user doesn't exist
            tenant: tenantId,
            role,
            status: 'pending',
            invitedBy: user.id,
            invitationDetails: {
              invitationToken: token,
              invitationExpiresAt: expiresAt.toISOString(),
              invitationMessage: options.message || undefined,
              invitationEmail: email,
            },
          } as any,
          overrideAccess: true,
        })

        // Send email (connector-resolved per tenant)
        await sendTenantInvitationEmail({
          payload,
          tenantId,
          recipientEmail: email,
          inviterName,
          enterpriseName,
          inviteUrl,
          role,
          message: options.message,
        })

        // Update contact
        await payload.update({
          collection: 'contacts',
          id: contact.id,
          data: {
            contactStatus: 'invited',
            inviteStatus: 'pending',
            lastInvitedAt: new Date().toISOString(),
            inviteCount: (contact.inviteCount || 0) + 1,
          },
          overrideAccess: true,
        })

        invited++
      } catch (err) {
        failed++
        errors.push(`${email}: ${err instanceof Error ? err.message : 'failed'}`)
      }
    }

    // Rate limit protection between batches
    if (i + BATCH_SIZE < contacts.length) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  return {
    success: true,
    invited,
    skipped,
    failed,
    errors: errors.slice(0, 50),
  }
}

// ── Delete Contacts ──────────────────────────────────────────────────────────

export async function deleteContacts(
  contactIds: (string | number)[],
): Promise<{ success: boolean; deleted: number; error?: string }> {
  const { payload, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId) {
    return { success: false, deleted: 0, error: error || 'No tenant' }
  }

  let deleted = 0
  for (const id of contactIds) {
    try {
      await payload.delete({
        collection: 'contacts',
        id,
        overrideAccess: true,
      })
      deleted++
    } catch {
      // Skip failures
    }
  }

  return { success: true, deleted }
}

// ── Metered Campaign Send ──────────────────────────────────────────────────────
//
// Marketing/broadcast email to a filtered audience, metered by the CLIENT: the UI
// calls sendCampaignChunk repeatedly, paced to a chosen rate, so a single send
// never exceeds the connector's limits or a serverless timeout. State lives on the
// contact rows (lastEmailedAt/emailCount), so a run is idempotent and resumable —
// `since` gates out anyone already emailed in this run.

export interface CampaignAudience {
  /** Restrict to a single source (e.g. 'clerk-lms') */
  source?: string
  /** Restrict to contacts carrying this tag */
  tag?: string
  /** Restrict by invite status */
  inviteStatus?: string
}

export interface CampaignAudienceResult {
  success: boolean
  eligible: number
  suppressed: number
  error?: string
}

export interface SendCampaignChunkOptions {
  subject: string
  /** Body HTML (plain newline text is converted to HTML by the caller) */
  html: string
  /** Plain-text alternative */
  text?: string
  audience: CampaignAudience
  /** ISO timestamp the run started; only contacts NOT emailed since this are sent */
  since: string
  /** Max emails to send this call (default 10) */
  chunkSize?: number
}

export interface CampaignChunkResult {
  success: boolean
  sent: number
  failed: number
  remaining: number
  provider?: string
  errors: string[]
  error?: string
}

/** Build the Payload `where` for an audience (excludes unsubscribed + bounced). */
function buildAudienceWhere(tenantId: number | string, audience: CampaignAudience): any[] {
  const where: any[] = [
    { tenant: { equals: tenantId } },
    { contactStatus: { not_in: ['unsubscribed', 'bounced'] } },
  ]
  if (audience.source) where.push({ source: { equals: audience.source } })
  if (audience.tag) where.push({ tags: { contains: audience.tag } })
  if (audience.inviteStatus) where.push({ inviteStatus: { equals: audience.inviteStatus } })
  return where
}

/** Personalize a template: {{name}}, {{email}}, {{unsubscribe_url}}. */
function personalize(
  template: string,
  vars: { name: string; email: string; unsubscribeUrl: string },
): string {
  return template
    .replace(/\{\{\s*name\s*\}\}/g, vars.name)
    .replace(/\{\{\s*email\s*\}\}/g, vars.email)
    .replace(/\{\{\s*unsubscribe_url\s*\}\}/g, vars.unsubscribeUrl)
}

/**
 * Count the eligible audience for a campaign (excludes unsubscribed/bounced),
 * plus how many matching contacts are suppressed — so the admin sees the real
 * reach before hitting send.
 */
export async function getCampaignAudience(
  audience: CampaignAudience,
): Promise<CampaignAudienceResult> {
  const { payload, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId) {
    return { success: false, eligible: 0, suppressed: 0, error: error || 'No tenant' }
  }

  const baseWhere: any[] = [{ tenant: { equals: tenantId } }]
  if (audience.source) baseWhere.push({ source: { equals: audience.source } })
  if (audience.tag) baseWhere.push({ tags: { contains: audience.tag } })
  if (audience.inviteStatus) baseWhere.push({ inviteStatus: { equals: audience.inviteStatus } })

  const [eligible, total] = await Promise.all([
    payload.count({
      collection: 'contacts',
      where: { and: buildAudienceWhere(tenantId, audience) },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'contacts',
      where: { and: baseWhere },
      overrideAccess: true,
    }),
  ])

  return {
    success: true,
    eligible: eligible.totalDocs,
    suppressed: total.totalDocs - eligible.totalDocs,
  }
}

/**
 * Send one metered chunk of a campaign. The client calls this repeatedly, paced
 * to the chosen rate. Returns how many were sent/failed and how many remain so
 * the client knows when to stop.
 */
export async function sendCampaignChunk(
  options: SendCampaignChunkOptions,
): Promise<CampaignChunkResult> {
  const { payload, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId) {
    return { success: false, sent: 0, failed: 0, remaining: 0, errors: [], error: error || 'No tenant' }
  }

  const subject = (options.subject || '').trim()
  if (!subject || !options.html?.trim()) {
    return { success: false, sent: 0, failed: 0, remaining: 0, errors: [], error: 'Subject and body are required' }
  }

  const chunkSize = Math.min(Math.max(options.chunkSize || 10, 1), 50)
  const since = options.since

  // Only contacts in-audience AND not already emailed in this run.
  const where = {
    and: [
      ...buildAudienceWhere(tenantId, options.audience),
      { or: [{ lastEmailedAt: { exists: false } }, { lastEmailedAt: { less_than: since } }] },
    ],
  }

  const batch = await payload.find({
    collection: 'contacts',
    where,
    limit: chunkSize,
    sort: 'createdAt',
    depth: 0,
    overrideAccess: true,
  })

  if (batch.docs.length === 0) {
    return { success: true, sent: 0, failed: 0, remaining: 0, errors: [] }
  }

  const sender = await resolveEmailSender(payload, tenantId)
  const baseUrl = getServerSideURL()
  const nowIso = new Date().toISOString()

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const contact of batch.docs as any[]) {
    const email = (contact.email as string).toLowerCase()
    try {
      // Lazily mint an unsubscribe token the first time we email this contact.
      let token = contact.unsubscribeToken as string | undefined
      if (!token) {
        token = generateInvitationToken()
        await payload.update({
          collection: 'contacts',
          id: contact.id,
          data: { unsubscribeToken: token } as any,
          overrideAccess: true,
        })
      }
      const unsubscribeUrl = `${baseUrl}/unsubscribe/${token}`
      const name = (contact.name as string) || ''
      const vars = { name, email, unsubscribeUrl }

      const bodyHtml = personalize(options.html, vars)
      const bodyText = personalize(options.text || '', vars)

      const html = `${bodyHtml}
        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
        <p style="font-size:12px;color:#999;text-align:center;">
          You're receiving this because you're on our contact list.
          <a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a>
        </p>`
      const text = `${bodyText || bodyHtml.replace(/<[^>]+>/g, '')}\n\nUnsubscribe: ${unsubscribeUrl}`

      await sender.sendEmail({ to: email, subject: personalize(subject, vars), html, text })

      // Stamp lastEmailedAt on success so the run advances and never re-sends.
      await payload.update({
        collection: 'contacts',
        id: contact.id,
        data: {
          lastEmailedAt: nowIso,
          emailCount: (contact.emailCount || 0) + 1,
        } as any,
        overrideAccess: true,
      })
      sent++
    } catch (err) {
      failed++
      errors.push(`${email}: ${err instanceof Error ? err.message : 'failed'}`)
      // Stamp lastEmailedAt even on failure so a transient error doesn't trap the
      // run in an infinite retry of the same row. Admin can re-run later.
      try {
        await payload.update({
          collection: 'contacts',
          id: contact.id,
          data: { lastEmailedAt: nowIso } as any,
          overrideAccess: true,
        })
      } catch {
        /* non-critical */
      }
    }
  }

  // How many still remain for this run (in-audience, not yet emailed since `since`).
  const remainingCount = await payload.count({ collection: 'contacts', where, overrideAccess: true })

  return {
    success: true,
    sent,
    failed,
    remaining: remainingCount.totalDocs,
    provider: sender.provider,
    errors: errors.slice(0, 50),
  }
}
