'use server'

/**
 * Invitations — Server Actions
 *
 * Quick Invite: create a TenantMembership with invitation details and send email.
 * Uses existing invitation infrastructure from invitationSystem.ts and sendTenantInvitationEmail.ts.
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { generateInvitationToken, calculateExpiration, isValidEmail } from '@/utilities/invitationSystem'
import { sendTenantInvitationEmail } from '@/utilities/sendTenantInvitationEmail'
import { getServerSideURL } from '@/utilities/getURL'

// ── Types ────────────────────────────────────────────────────────────────────

export interface QuickInviteResult {
  success: boolean
  inviteUrl?: string
  emailSent?: boolean
  error?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthenticatedAdmin() {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    return { payload, user: null, tenantId: null, tenantName: '', error: 'Not authenticated' }
  }

  const roles = (user as any).roles as string[] | undefined
  const isAdmin = Boolean(
    roles?.includes('super_admin') || roles?.includes('admin') || roles?.includes('archangel'),
  )

  if (!isAdmin) {
    return { payload, user, tenantId: null, tenantName: '', error: 'Insufficient permissions' }
  }

  const tenantSlug =
    headersList.get('x-tenant-id') || process.env.DEFAULT_TENANT_SLUG || 'default'
  const tenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: tenantSlug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const tenant = tenants.docs[0] as any
  if (!tenant) {
    return { payload, user, tenantId: null, tenantName: '', error: 'Tenant not found' }
  }

  return { payload, user, tenantId: tenant.id, tenantName: tenant.name || 'Enterprise', error: null }
}

// ── sendQuickInvite ──────────────────────────────────────────────────────────

export async function sendQuickInvite(input: {
  email: string
  role: string
  message?: string
}): Promise<QuickInviteResult> {
  const { payload, user, tenantId, tenantName, error } = await getAuthenticatedAdmin()
  if (error || !tenantId || !user) {
    return { success: false, error: error || 'Auth failed' }
  }

  const email = input.email?.trim().toLowerCase()
  if (!email || !isValidEmail(email)) {
    return { success: false, error: 'Please enter a valid email address' }
  }

  const role = input.role || 'tenant_member'

  // Check if an active or pending membership already exists for this email
  const existing = await payload.find({
    collection: 'tenant-memberships',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { 'invitationDetails.invitationEmail': { equals: email } },
        { status: { in: ['active', 'pending'] } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.totalDocs > 0) {
    const existingStatus = (existing.docs[0] as any).status
    if (existingStatus === 'active') {
      return { success: false, error: 'This person is already a member of your Enterprise' }
    }
    return { success: false, error: 'An invitation is already pending for this email' }
  }

  // Generate invitation token and create membership
  const token = generateInvitationToken()
  const expiresAt = calculateExpiration(7)
  const baseUrl = getServerSideURL()
  const inviteUrl = `${baseUrl}/tenant-invite/${token}`

  await payload.create({
    collection: 'tenant-memberships',
    data: {
      tenant: tenantId,
      role,
      status: 'pending',
      invitedBy: user.id,
      invitationDetails: {
        invitationEmail: email,
        invitationToken: token,
        invitationExpiresAt: expiresAt.toISOString(),
      },
    } as any,
    overrideAccess: true,
  })

  // Send invitation email
  const inviterName = (user as any).name || (user as any).email || 'An admin'
  let emailSent = false
  try {
    emailSent = await sendTenantInvitationEmail({
      payload,
      recipientEmail: email,
      inviterName,
      enterpriseName: tenantName,
      inviteUrl,
      role,
      message: input.message,
    })
  } catch {
    // Email sending failed — invitation is still created
  }

  return { success: true, inviteUrl, emailSent }
}
