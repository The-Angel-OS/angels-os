'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { parseCSV, parseJSON } from '@/utilities/csvParser'
import {
  generateInvitationToken,
  calculateExpiration,
  isValidEmail,
} from '@/utilities/invitationSystem'
import { sendTenantInvitationEmail } from '@/utilities/sendTenantInvitationEmail'

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

  // Resolve tenant from header
  const tenantSlug = headersList.get('x-tenant-id') || process.env.DEFAULT_TENANT_SLUG || 'default'
  const tenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: tenantSlug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const tenantId = tenants.docs[0]?.id
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
