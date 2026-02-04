/**
 * Seed helpers: find-or-create and ID resolution.
 * Handles existence before creating; ensures relational fields use resolved IDs.
 */
import type { Payload, PayloadRequest } from 'payload'

export const INITIAL_USER_EMAILS = {
  admin: 'kenneth.courtney@gmail.com',
  customer: 'customer@angelos.local',
} as const

export const DEFAULT_TENANT_SLUG = 'default'

/** Email pattern for LEO system users (one per tenant). */
export function leoSystemUserEmail(tenantSlug: string): string {
  return `leo-${tenantSlug}@system.angelos.local`
}

/** Find tenant by slug; create if not exists. Returns tenant with id. */
export async function findOrCreateTenant(
  payload: Payload,
  req: PayloadRequest,
  data: { name: string; slug: string; domain: string; branding?: Record<string, unknown> },
): Promise<{ id: number | string; name: string; slug: string }> {
  const existing = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: data.slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs?.[0]) {
    const t = existing.docs[0] as { id: number | string; name: string; slug: string }
    return { id: t.id, name: t.name, slug: t.slug }
  }
  const created = await payload.create({
    collection: 'tenants',
    data: { ...data, status: 'active' },
    req,
    overrideAccess: true,
  })
  return { id: created.id, name: created.name, slug: created.slug }
}

/** Find user by email; create if not exists. Returns user with id. */
export async function findOrCreateUser(
  payload: Payload,
  req: PayloadRequest,
  data: {
    email: string
    name: string
    password: string
    roles: string[]
    tenantId?: number | string
  },
): Promise<{ id: number | string; email: string }> {
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: data.email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs?.[0]) {
    const u = existing.docs[0] as { id: number | string; email: string }
    return { id: u.id, email: u.email }
  }
  const createData = {
    email: data.email,
    name: data.name,
    password: data.password,
    roles: data.roles,
    ...(data.tenantId != null ? { tenants: [{ tenant: data.tenantId as number }] } : {}),
  }
  const created = await payload.create({
    collection: 'users',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- seed helper accepts flexible roles
    data: createData as any,
    req,
    overrideAccess: true,
    draft: false,
  })
  return { id: created.id, email: created.email }
}

/** Find or create system agent user (LEO, Support, etc.) for a tenant. */
export async function findOrCreateSystemAgent(
  payload: Payload,
  req: PayloadRequest,
  data: {
    tenantId: number | string
    tenantSlug: string
    agentType?: string
    displayName?: string
    personality?: string
    capabilities?: string[]
    routingRules?: {
      channels?: Array<{ channelSlug: string }>
      keywords?: Array<{ keyword: string }>
      isDefault?: boolean
    }
  },
): Promise<{ id: number | string; email: string }> {
  const agentType = data.agentType ?? 'leo'
  const email = `${agentType}-${data.tenantSlug}@system.angelos.local`
  
  const existing = await payload.find({
    collection: 'users',
    where: { 
      and: [
        { email: { equals: email } },
        { isSystemUser: { equals: true } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  
  if (existing.docs?.[0]) {
    const u = existing.docs[0] as { id: number | string; email: string }
    return { id: u.id, email: u.email }
  }
  
  const createData = {
    email,
    name: data.displayName ?? agentType.toUpperCase(),
    password: `system-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    roles: [],
    isSystemUser: true,
    servesTenant: data.tenantId,
    agentConfig: {
      agentType,
      displayName: data.displayName ?? agentType.toUpperCase(),
      personality: data.personality ?? getDefaultPersonality(agentType),
      capabilities: data.capabilities ?? getDefaultCapabilities(agentType),
      routingRules: data.routingRules ?? getDefaultRoutingRules(agentType),
    },
  }
  
  const created = await payload.create({
    collection: 'users',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- system agent seed
    data: createData as any,
    req,
    overrideAccess: true,
    draft: false,
  })
  return { id: created.id, email: (created as { email: string }).email }
}

/** Backward compatibility: Find or create LEO agent. */
export async function findOrCreateLeoUser(
  payload: Payload,
  req: PayloadRequest,
  data: { tenantId: number | string; tenantSlug: string; displayName?: string },
): Promise<{ id: number | string; email: string }> {
  return findOrCreateSystemAgent(payload, req, {
    ...data,
    agentType: 'leo',
  })
}

/** Default personality for agent types. */
function getDefaultPersonality(agentType: string): string {
  const personalities: Record<string, string> = {
    leo: 'Friendly, helpful, and knowledgeable. I help with navigation, content discovery, and general questions about the platform.',
    support: 'Professional and empathetic. I help resolve issues, answer technical questions, and escalate when needed.',
    sales: 'Enthusiastic and consultative. I help customers find the right products and complete purchases.',
    onboarding: 'Patient and encouraging. I guide new users through setup and first steps.',
    integration: 'Technical and precise. I handle data synchronization and external system communication.',
    custom: 'Configurable agent - personality set by admin.',
  }
  return personalities[agentType] ?? personalities.custom
}

/** Default capabilities for agent types. LEO as web master gets full CRUD on core collections. */
function getDefaultCapabilities(agentType: string): string[] {
  const capabilities: Record<string, string[]> = {
    leo: [
      'query_posts',
      'create_posts',
      'update_posts',
      'query_products',
      'create_products',
      'update_products',
      'query_pages',
      'create_pages',
      'update_pages',
      'manage_categories',
      'manage_media',
      'manage_navigation',
      'manage_spaces',
    ],
    support: ['query_posts', 'send_emails'],
    sales: ['query_products', 'create_orders'],
    onboarding: ['query_posts', 'manage_spaces'],
    integration: ['external_api', 'query_posts', 'query_products'],
    custom: [],
  }
  return capabilities[agentType] ?? []
}

/** Default routing rules for agent types. */
function getDefaultRoutingRules(agentType: string): {
  channels?: Array<{ channelSlug: string }>
  keywords?: Array<{ keyword: string }>
  isDefault?: boolean
} {
  const rules: Record<string, any> = {
    leo: {
      isDefault: true, // LEO is the default agent
      keywords: [{ keyword: 'help' }, { keyword: 'leo' }],
    },
    support: {
      channels: [{ channelSlug: 'support' }],
      keywords: [{ keyword: 'support' }, { keyword: 'help' }, { keyword: 'issue' }],
    },
    sales: {
      channels: [{ channelSlug: 'sales' }],
      keywords: [{ keyword: 'buy' }, { keyword: 'purchase' }, { keyword: 'order' }],
    },
    onboarding: {
      channels: [{ channelSlug: 'onboarding' }, { channelSlug: 'welcome' }],
      keywords: [{ keyword: 'start' }, { keyword: 'setup' }, { keyword: 'begin' }],
    },
    integration: {
      keywords: [{ keyword: 'sync' }, { keyword: 'import' }, { keyword: 'export' }],
    },
  }
  return rules[agentType] ?? { isDefault: false }
}

/** Find TenantMembership by user+tenant; create if not exists. */
export async function findOrCreateTenantMembership(
  payload: Payload,
  req: PayloadRequest,
  data: { userId: number | string; tenantId: number | string; role: string },
): Promise<void> {
  const existing = await payload.find({
    collection: 'tenant-memberships',
    where: {
      and: [
        { user: { equals: data.userId } },
        { tenant: { equals: data.tenantId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs?.[0]) return

  await payload.create({
    collection: 'tenant-memberships',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- seed helper
    data: { user: data.userId, tenant: data.tenantId, role: data.role, status: 'active', joinedAt: new Date().toISOString() } as any,
    depth: 0,
    req,
    overrideAccess: true,
  })
}

/** Find SpaceMembership by user+space; create if not exists. */
export async function findOrCreateSpaceMembership(
  payload: Payload,
  req: PayloadRequest,
  data: { userId: number | string; spaceId: number | string; role: string },
): Promise<void> {
  const existing = await payload.find({
    collection: 'space-memberships',
    where: {
      and: [
        { user: { equals: data.userId } },
        { space: { equals: data.spaceId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs?.[0]) return

  await payload.create({
    collection: 'space-memberships',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- seed helper
    data: { user: data.userId, space: data.spaceId, role: data.role, status: 'active', joinedAt: new Date().toISOString() } as any,
    depth: 0,
    req,
    overrideAccess: true,
  })
}
