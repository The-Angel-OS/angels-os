/**
 * Address Book endpoint — GET /api/address-book-ops/list
 *
 * The signed-in user's "my people" roster: conversation partners (DM channels)
 * first, then reachable CRM contacts. This is Nimue's home surface.
 *
 * Auth required. Tenant resolved from the `x-tenant-id` header (slug) — the same
 * convention as membership-self — with a `?tenant=` query fallback.
 *
 * NB: mounted under `/address-book-ops/*`, NOT `/contacts`, because a `contacts`
 * collection exists and would shadow the REST route (the -ops suffix rule).
 *
 * @see src/utilities/addressBook.ts
 */
import type { PayloadHandler } from 'payload'
import { getAddressBook } from '@/utilities/addressBook'

async function resolveTenantId(req: Parameters<PayloadHandler>[0]): Promise<number | string | null> {
  const url = new URL(req.url || '', 'http://localhost')
  const slug = req.headers?.get('x-tenant-id') || url.searchParams.get('tenant') || ''
  if (!slug) return null
  const tenants = await req.payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const t = tenants.docs?.[0] as { id: number | string } | undefined
  return t?.id ?? null
}

/**
 * GET /api/address-book-ops/all — the signed-in user's people across ALL their
 * tenants (DM partners + CRM contacts), deduped by email. Session-based, no tenant
 * param — so a client can fetch once and filter locally (invite autocomplete). Only
 * surfaces people the user actually has a relationship with (never the whole user DB).
 */
export const addressBookAllHandler: PayloadHandler = async (req) => {
  const user = req.user as { id?: number | string } | null
  if (!user?.id) return Response.json({ error: 'auth required' }, { status: 401 })

  const mem = await req.payload.find({
    collection: 'tenant-memberships',
    where: { and: [{ user: { equals: user.id } }, { status: { equals: 'active' } }] },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  const tenantIds = [
    ...new Set(
      (mem.docs as Array<{ tenant: unknown }>)
        .map((m) => (m.tenant && typeof m.tenant === 'object' ? (m.tenant as { id: unknown }).id : m.tenant))
        .filter(Boolean),
    ),
  ].slice(0, 12) // bound the fan-out

  const byEmail = new Map<string, { name: string; email: string }>()
  for (const tid of tenantIds) {
    try {
      const entries = await getAddressBook(req.payload, {
        tenantId: tid as number | string,
        userId: user.id,
        includeContacts: true,
        limit: 300,
      })
      for (const e of entries) {
        if (!e.email) continue
        const key = e.email.toLowerCase()
        if (!byEmail.has(key)) byEmail.set(key, { name: e.name, email: e.email })
      }
    } catch {
      /* one tenant failing shouldn't sink the whole roster */
    }
  }

  const people = [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name))
  return Response.json({ people, count: people.length })
}

export const addressBookListHandler: PayloadHandler = async (req) => {
  const user = req.user as { id?: number | string } | null
  if (!user?.id) return Response.json({ error: 'auth required' }, { status: 401 })

  const tenantId = await resolveTenantId(req)
  if (!tenantId) {
    return Response.json(
      { error: 'tenant could not be resolved (send x-tenant-id header or ?tenant=)' },
      { status: 400 },
    )
  }

  const url = new URL(req.url || '', 'http://localhost')
  const includeContacts = url.searchParams.get('includeContacts') !== 'false'
  const limitParam = Number(url.searchParams.get('limit'))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 200

  const entries = await getAddressBook(req.payload, {
    tenantId,
    userId: user.id,
    includeContacts,
    limit,
  })

  return Response.json({ entries, count: entries.length })
}
