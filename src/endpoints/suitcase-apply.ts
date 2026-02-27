/**
 * Suitcase Apply Endpoint — POST /api/suitcase/apply
 *
 * Idempotent create-or-update for portable Endeavor suitcases.
 * Accepts a suitcase JSON (same format as export) and provisions the tenant,
 * spaces, channels, LEO agent, and draft products.
 *
 * Unlike the UI import (which appends `-imported-{timestamp}` to slugs),
 * this endpoint is idempotent: if the tenant slug already exists, it updates
 * branding/config and ensures spaces + channels exist.
 *
 * Also supports loading built-in suitcases by name (e.g., `{ "builtin": "dovydas-music" }`).
 *
 * Security: Protected by Authorization: Bearer CRON_SECRET (same as cron endpoints).
 *
 * Usage:
 *   curl -X POST https://spacesangels.com/api/suitcase/apply \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d @src/suitcases/dovydas-music.json
 *
 *   # Or use a built-in suitcase:
 *   curl -X POST https://spacesangels.com/api/suitcase/apply \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{ "builtin": "dovydas-music" }'
 */

import type { PayloadHandler, Payload } from 'payload'

import { logError } from '@/utilities/logError'

// ─── Built-in suitcases ────────────────────────────────────────────────────────

import dovydasSuitcase from '@/suitcases/dovydas-music.json'

const BUILTIN_SUITCASES: Record<string, unknown> = {
  'dovydas-music': dovydasSuitcase,
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SuitcaseInput {
  builtin?: string
  manifest?: {
    version: string
    constitutional?: { isAngel?: boolean }
    tenant?: { name: string; slug: string }
  }
  tenant?: Record<string, unknown>
  spaces?: Array<Record<string, unknown>>
  channels?: Array<Record<string, unknown>>
  products?: Array<Record<string, unknown>>
  nimue?: {
    angelName?: string
    personality?: string
    domainExpertise?: string
  }
}

// ─── Handler ───────────────────────────────────────────────────────────────────

export const suitcaseApplyHandler: PayloadHandler = async (req) => {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }
  }

  const payload = req.payload

  // ── Parse input ─────────────────────────────────────────────────────────────
  let suitcase: SuitcaseInput
  try {
    const body = await req.json?.()
    if (!body) {
      return Response.json({ message: 'Request body required' }, { status: 400 })
    }

    // Built-in suitcase by name
    if (body.builtin && typeof body.builtin === 'string') {
      const builtin = BUILTIN_SUITCASES[body.builtin]
      if (!builtin) {
        return Response.json(
          { message: `Unknown built-in suitcase: ${body.builtin}`, available: Object.keys(BUILTIN_SUITCASES) },
          { status: 404 },
        )
      }
      suitcase = builtin as SuitcaseInput
    } else {
      suitcase = body as SuitcaseInput
    }
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Validate ────────────────────────────────────────────────────────────────
  if (!suitcase.manifest || suitcase.manifest.version !== '1.0.0') {
    return Response.json({ message: 'Invalid suitcase: missing manifest or unsupported version' }, { status: 400 })
  }

  if (!suitcase.manifest.constitutional?.isAngel) {
    return Response.json({ message: 'Suitcase rejected: anti-demonic safeguard (isAngel !== true)' }, { status: 403 })
  }

  if (!suitcase.tenant) {
    return Response.json({ message: 'Invalid suitcase: missing tenant data' }, { status: 400 })
  }

  const tenantData = suitcase.tenant as Record<string, unknown>
  const tenantSlug = String(tenantData.slug || '')
  const tenantName = String(tenantData.name || tenantSlug)

  if (!tenantSlug) {
    return Response.json({ message: 'Invalid suitcase: tenant.slug is required' }, { status: 400 })
  }

  // ── Apply suitcase (idempotent) ─────────────────────────────────────────────
  const results = {
    tenant: { action: 'none' as string, id: null as number | string | null },
    spaces: [] as Array<{ slug: string; action: string; id: number | string }>,
    channels: [] as Array<{ slug: string; action: string }>,
    leo: { action: 'none' as string },
    products: [] as Array<{ slug: string; action: string }>,
    errors: [] as string[],
  }

  try {
    // ── 1. Find-or-create tenant ──────────────────────────────────────────────
    const { tenantId, action: tenantAction } = await findOrCreateTenantFromSuitcase(payload, tenantData)
    results.tenant = { action: tenantAction, id: tenantId }

    // ── 2. Create spaces ──────────────────────────────────────────────────────
    const spaceSlugToId = new Map<string, number | string>()

    for (const space of suitcase.spaces || []) {
      const s = space as Record<string, unknown>
      const spaceSlug = String(s.slug || '')
      if (!spaceSlug) continue

      try {
        const { spaceId, action } = await findOrCreateSpace(payload, tenantId, s)
        spaceSlugToId.set(spaceSlug, spaceId)
        results.spaces.push({ slug: spaceSlug, action, id: spaceId })
      } catch (err) {
        const msg = `Space ${spaceSlug}: ${err instanceof Error ? err.message : String(err)}`
        results.errors.push(msg)
      }
    }

    // ── 3. Create channels ────────────────────────────────────────────────────
    for (const channel of suitcase.channels || []) {
      const ch = channel as Record<string, unknown>
      const chSlug = String(ch.slug || '')
      if (!chSlug) continue

      // Resolve space by slug reference (suitcase uses spaceSlug, not space ID)
      const spaceSlug = String(ch.spaceSlug || ch.space || '')
      const spaceId = spaceSlugToId.get(spaceSlug)
      if (!spaceId) {
        results.errors.push(`Channel ${chSlug}: space "${spaceSlug}" not found`)
        continue
      }

      try {
        const action = await findOrCreateChannel(payload, tenantId, spaceId, ch)
        results.channels.push({ slug: chSlug, action })
      } catch (err) {
        const msg = `Channel ${chSlug}: ${err instanceof Error ? err.message : String(err)}`
        results.errors.push(msg)
      }
    }

    // ── 4. Create LEO agent ───────────────────────────────────────────────────
    if (suitcase.nimue) {
      try {
        const action = await findOrCreateLeo(payload, tenantId, tenantSlug, suitcase.nimue)
        results.leo = { action }
      } catch (err) {
        const msg = `LEO: ${err instanceof Error ? err.message : String(err)}`
        results.errors.push(msg)
      }
    }

    // ── 5. Create draft products ──────────────────────────────────────────────
    for (const product of suitcase.products || []) {
      const p = product as Record<string, unknown>
      const pSlug = String(p.slug || '')
      if (!pSlug) continue

      try {
        const action = await findOrCreateProduct(payload, tenantId, p)
        results.products.push({ slug: pSlug, action })
      } catch (err) {
        const msg = `Product ${pSlug}: ${err instanceof Error ? err.message : String(err)}`
        results.errors.push(msg)
      }
    }
  } catch (err) {
    await logError({
      source: 'suitcase-apply',
      message: 'Suitcase apply failed',
      details: err instanceof Error ? err.message : String(err),
    })
    return Response.json(
      { message: 'Suitcase apply failed', error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }

  return Response.json({
    message: 'Suitcase applied successfully',
    tenant: tenantSlug,
    results,
  })
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function findOrCreateTenantFromSuitcase(
  payload: Payload,
  data: Record<string, unknown>,
): Promise<{ tenantId: number | string; action: string }> {
  const slug = String(data.slug)

  const existing = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs?.[0]) {
    const tenant = existing.docs[0]
    // Update branding, storefront, commerce, businessType if provided
    const updateData: Record<string, unknown> = {}
    if (data.branding) updateData.branding = data.branding
    if (data.storefront) updateData.storefront = data.storefront
    if (data.commerce) updateData.commerce = data.commerce
    if (data.businessType) updateData.businessType = data.businessType
    if (data.domain) updateData.domain = data.domain

    if (Object.keys(updateData).length > 0) {
      await payload.update({
        collection: 'tenants',
        id: tenant.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: updateData as any,
        overrideAccess: true,
      })
      return { tenantId: tenant.id, action: 'updated' }
    }

    return { tenantId: tenant.id, action: 'exists' }
  }

  // Create new tenant
  const created = await payload.create({
    collection: 'tenants',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: {
      name: String(data.name),
      slug,
      domain: String(data.domain || `${slug}.spacesangels.com`),
      type: String(data.type || 'tenant'),
      status: 'active',
      businessType: data.businessType,
      branding: data.branding,
      storefront: data.storefront,
      commerce: data.commerce,
    } as any,
    overrideAccess: true,
  })

  return { tenantId: created.id, action: 'created' }
}

async function findOrCreateSpace(
  payload: Payload,
  tenantId: number | string,
  data: Record<string, unknown>,
): Promise<{ spaceId: number | string; action: string }> {
  const slug = String(data.slug)

  const existing = await payload.find({
    collection: 'spaces',
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
    return { spaceId: existing.docs[0].id, action: 'exists' }
  }

  const created = await payload.create({
    collection: 'spaces',
    data: {
      name: String(data.name || slug),
      slug,
      description: String(data.description || ''),
      tenant: tenantId as number,
      visibility: String(data.visibility || 'invite_only') as 'invite_only',
    },
    overrideAccess: true,
  })

  return { spaceId: created.id, action: 'created' }
}

async function findOrCreateChannel(
  payload: Payload,
  tenantId: number | string,
  spaceId: number | string,
  data: Record<string, unknown>,
): Promise<string> {
  const slug = String(data.slug)

  const existing = await payload.find({
    collection: 'channels',
    where: {
      and: [
        { slug: { equals: slug } },
        { tenant: { equals: tenantId } },
        { space: { equals: spaceId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs?.[0]) {
    return 'exists'
  }

  await payload.create({
    collection: 'channels',
    data: {
      name: String(data.name || slug),
      slug,
      description: String(data.description || ''),
      space: spaceId as number,
      type: (data.type || 'general') as 'general',
      isDefault: Boolean(data.isDefault),
      tenant: tenantId as number,
    },
    overrideAccess: true,
  })

  return 'created'
}

async function findOrCreateLeo(
  payload: Payload,
  tenantId: number | string,
  tenantSlug: string,
  nimue: { angelName?: string; personality?: string; domainExpertise?: string },
): Promise<string> {
  const { leoSystemUserEmail } = await import('./seed/seed-helpers.js')
  const email = leoSystemUserEmail(tenantSlug)

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
    return 'exists'
  }

  // Check legacy email pattern for migration
  const legacyEmail = `leo-${tenantSlug}@system.angelos.local`
  if (legacyEmail !== email) {
    const legacy = await payload.find({
      collection: 'users',
      where: { and: [{ email: { equals: legacyEmail } }, { isSystemUser: { equals: true } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (legacy.docs?.[0]) {
      return 'exists'
    }
  }

  const personality = nimue.domainExpertise
    ? `${nimue.personality || ''}\n\nDomain expertise: ${nimue.domainExpertise}`
    : nimue.personality || ''

  await payload.create({
    collection: 'users',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: {
      email,
      name: nimue.angelName || 'LEO',
      password: `system-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      roles: [],
      isSystemUser: true,
      servesTenant: tenantId,
      agentConfig: {
        agentType: 'leo',
        angelName: nimue.angelName || 'LEO',
        displayName: nimue.angelName || 'LEO',
        personality,
        capabilities: [
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
        appearance: { color: '#10B981', emoji: '\uD83E\uDD85' },
        routingRules: {
          isDefault: true,
          keywords: [{ keyword: 'help' }, { keyword: 'leo' }],
        },
      },
    } as any,
    overrideAccess: true,
    draft: false,
  })

  return 'created'
}

async function findOrCreateProduct(
  payload: Payload,
  tenantId: number | string,
  data: Record<string, unknown>,
): Promise<string> {
  const slug = String(data.slug)

  const existing = await payload.find({
    collection: 'products',
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
    return 'exists'
  }

  await payload.create({
    collection: 'products',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: {
      title: String(data.title || slug),
      slug,
      description: String(data.description || ''),
      price: Number(data.price || 0),
      _status: 'draft',
      tenant: tenantId as number,
    } as any,
    overrideAccess: true,
  })

  return 'created'
}
