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
