'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { checkRole } from '@/access/utilities'

export interface SuitcaseManifest {
  version: '1.0.0'
  angelOS: string
  exportedAt: string
  exportedBy: string
  tenant: {
    name: string
    slug: string
    domain: string
    type: string
    status: string
    branding: Record<string, unknown>
  }
  contents: {
    spaces: number
    channels: number
    messages: number
    users: number
    posts: number
    products: number
    media: number
  }
  constitutional: {
    isAngel: boolean
    revenueModel: '70/20/4/1/5'
    antiDemonic: true
  }
}

export interface SuitcaseData {
  manifest: SuitcaseManifest
  tenant: Record<string, unknown>
  spaces: Record<string, unknown>[]
  channels: Record<string, unknown>[]
  users: Record<string, unknown>[]
  messages: Record<string, unknown>[]
  posts: Record<string, unknown>[]
  products: Record<string, unknown>[]
  media: Array<{ metadata: Record<string, unknown>; url: string }>
}

export async function exportTenantSuitcase(tenantId: string | number): Promise<{
  success: boolean
  data?: SuitcaseData
  error?: string
}> {
  try {
    const payload = await getPayload({ config })
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Fetch tenant
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })

    if (!tenant) {
      return { success: false, error: 'Tenant not found' }
    }

    // Fetch all related data in parallel using Payload Local API
    const [spaces, channels, users, messages, posts, products, media] = await Promise.all([
      payload
        .find({
          collection: 'spaces',
          where: { tenant: { equals: tenantId } },
          limit: 1000,
          depth: 0,
          overrideAccess: true,
        })
        .then((r) => r.docs),
      payload
        .find({
          collection: 'channels',
          limit: 10000,
          depth: 1,
          overrideAccess: true,
        })
        .then((r) =>
          r.docs.filter((ch: any) => {
            const spaceRef = ch.space
            return typeof spaceRef === 'object' ? spaceRef?.tenant === tenantId : false
          }),
        ),
      payload
        .find({
          collection: 'tenant-memberships',
          where: { tenant: { equals: tenantId } },
          limit: 1000,
          depth: 1,
          overrideAccess: true,
        })
        .then((r) => r.docs),
      payload
        .find({
          collection: 'messages',
          limit: 10000,
          depth: 0,
          overrideAccess: true,
        })
        .then((r) => r.docs),
      payload
        .find({
          collection: 'posts',
          limit: 1000,
          depth: 0,
          overrideAccess: true,
        })
        .then((r) => r.docs),
      payload
        .find({
          collection: 'products',
          limit: 1000,
          depth: 0,
          overrideAccess: true,
        })
        .then((r) => r.docs),
      payload
        .find({
          collection: 'media',
          limit: 1000,
          depth: 0,
          overrideAccess: true,
        })
        .then((r) => r.docs),
    ])

    const manifest: SuitcaseManifest = {
      version: '1.0.0',
      angelOS: '3.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: (user as any).email || 'unknown',
      tenant: {
        name: (tenant as any).name,
        slug: (tenant as any).slug,
        domain: (tenant as any).domain,
        type: (tenant as any).type || 'tenant',
        status: (tenant as any).status || 'active',
        branding: (tenant as any).branding || {},
      },
      contents: {
        spaces: spaces.length,
        channels: channels.length,
        messages: messages.length,
        users: users.length,
        posts: posts.length,
        products: products.length,
        media: media.length,
      },
      constitutional: {
        isAngel: true,
        revenueModel: '70/20/4/1/5',
        antiDemonic: true,
      },
    }

    const suitcase: SuitcaseData = {
      manifest,
      tenant: tenant as any,
      spaces: spaces as any[],
      channels: channels as any[],
      users: users as any[],
      messages: messages as any[],
      posts: posts as any[],
      products: products as any[],
      media: media.map((m: any) => ({
        metadata: { filename: m.filename, alt: m.alt, mimeType: m.mimeType },
        url: m.url,
      })),
    }

    return { success: true, data: suitcase }
  } catch (err) {
    console.error('Export suitcase error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Export failed' }
  }
}

export async function importTenantSuitcase(suitcaseJson: string): Promise<{
  success: boolean
  tenantId?: string | number
  error?: string
}> {
  try {
    const payload = await getPayload({ config })
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    if (!checkRole(['super_admin', 'archangel'], user)) {
      return { success: false, error: 'Only super admins can import suitcases' }
    }

    const suitcase: SuitcaseData = JSON.parse(suitcaseJson)

    // Validate manifest
    if (!suitcase.manifest || suitcase.manifest.version !== '1.0.0') {
      return { success: false, error: 'Invalid suitcase format or unsupported version' }
    }

    if (!suitcase.manifest.constitutional?.isAngel) {
      return { success: false, error: 'Suitcase rejected: not from an Angel OS instance (anti-demonic safeguard)' }
    }

    // 1. Create tenant
    const tenantData = suitcase.tenant as any
    const newTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: tenantData.name,
        slug: `${tenantData.slug}-imported-${Date.now()}`,
        domain: tenantData.domain,
        type: tenantData.type || 'tenant',
        status: 'provisioning',
        branding: tenantData.branding,
      } as any,
      overrideAccess: true,
    })

    // 2. Import spaces
    const spaceIdMap = new Map<string | number, string | number>()
    for (const space of suitcase.spaces) {
      const s = space as any
      const created = await payload.create({
        collection: 'spaces',
        data: {
          name: s.name,
          slug: s.slug,
          description: s.description,
          tenant: newTenant.id,
          visibility: s.visibility || 'invite_only',
        },
        overrideAccess: true,
      })
      spaceIdMap.set(s.id, created.id)
    }

    // 3. Import channels linked to spaces
    for (const channel of suitcase.channels) {
      const ch = channel as any
      const oldSpaceId = typeof ch.space === 'object' ? ch.space?.id : ch.space
      const newSpaceId = spaceIdMap.get(oldSpaceId)
      if (newSpaceId) {
        await payload.create({
          collection: 'channels',
          data: {
            name: ch.name,
            slug: ch.slug,
            description: ch.description,
            space: newSpaceId as number,
            type: ch.type || 'general',
            isDefault: ch.isDefault || false,
          },
          overrideAccess: true,
        })
      }
    }

    // 4. Activate tenant
    await payload.update({
      collection: 'tenants',
      id: newTenant.id,
      data: { status: 'active' } as any,
      overrideAccess: true,
    })

    return { success: true, tenantId: newTenant.id }
  } catch (err) {
    console.error('Import suitcase error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Import failed',
    }
  }
}
