/**
 * renamePortalSlug — change a portal's public address WITHOUT breaking links.
 *
 * The endeavor changes shape: a personal guardian angel becomes "Sparkle
 * Pressure Washing," a docs-mover, a nail salon. Nimue/LEO reconfigures it and
 * the slug should follow — `q7fkm3wxr2np.kendev.co` → `sparkle-pressure-washing
 * .kendev.co` — because that URL is what Core sends on the user's behalf
 * (invites, donation forms, SEO).
 *
 * THE INVARIANT: renaming must never 404 a link already in the wild. We achieve
 * that by PRESERVING the old subdomain as an alias in `tenant.domains[]`. The
 * host resolver (fetchTenantByDomain, step 1b) matches alias domains, so an old
 * `old-slug.kendev.co` invite falls through slug→domain→alias and still lands on
 * the same tenant. Old links keep working forever; the new address is canonical.
 *
 * Fail-closed on conflicts (taken slug/domain, reserved word); idempotent when
 * the slug is already what's requested. No schema change — `slug`, `domain`, and
 * `domains[]` all already exist. Search re-announcement (IndexNow/sitemap) is a
 * best-effort follow-on, wired by the caller — see pingSearchReindex TODO.
 *
 * @see src/utilities/guardianSlug.ts — the slug rules
 * @see src/utilities/fetchTenantByDomain.ts — alias resolution (step 1b)
 * @see [[project_leo_factory_principle]] — exposed as a LEO tool wrapper
 */
import type { Payload, PayloadRequest } from 'payload'
import { slugify, vanitySlugRejection, guardianBaseDomain } from '@/utilities/guardianSlug'
import { tenantBySlugCache, tenantByDomainCache } from '@/utilities/tenantCache'

export interface RenamePortalSlugResult {
  ok: boolean
  slug: string
  domain: string
  url: string
  /** Old subdomain(s) preserved as aliases so prior links keep resolving. */
  aliasesPreserved: string[]
  /** True when the slug was already what was requested (no-op). */
  unchanged: boolean
}

export class RenameSlugError extends Error {
  constructor(
    message: string,
    public readonly code: 'invalid' | 'reserved' | 'taken' | 'not_found',
  ) {
    super(message)
    this.name = 'RenameSlugError'
  }
}

/** Invalidate every cache key a rename could touch (old + new slug/domain). */
function bustTenantCaches(slugs: string[], domains: string[]): void {
  for (const s of slugs) if (s) tenantBySlugCache.invalidate(s)
  for (const d of domains) {
    if (!d) continue
    tenantByDomainCache.invalidate(d)
    tenantByDomainCache.invalidate(`exact:${d}`)
  }
}

/**
 * Rename a tenant's slug + primary domain, preserving the old subdomain as an
 * alias. `newSlug` is validated against the shared vanity rules (format +
 * reserved words). Throws RenameSlugError on any conflict.
 */
export async function renamePortalSlug(
  payload: Payload,
  input: { tenantId: number | string; newSlug: string; baseDomain?: string },
  opts: { req?: PayloadRequest } = {},
): Promise<RenamePortalSlugResult> {
  const { req } = opts
  const newSlug = slugify(input.newSlug || '')

  const rejection = vanitySlugRejection(newSlug)
  if (rejection) {
    throw new RenameSlugError(rejection, RESERVED_OR_INVALID(newSlug))
  }

  const baseDomain = input.baseDomain
    ? input.baseDomain.replace(/^\.+|\.+$/g, '').toLowerCase()
    : guardianBaseDomain()
  const newDomain = `${newSlug}.${baseDomain}`

  // Load the tenant we're renaming.
  const tenant = (await payload.findByID({
    collection: 'tenants',
    id: input.tenantId as number,
    depth: 0,
    overrideAccess: true,
  })) as
    | { id: number | string; slug?: string; domain?: string; domains?: { domain: string }[] | null }
    | null
  if (!tenant) throw new RenameSlugError('portal not found', 'not_found')

  const oldSlug = (tenant.slug || '').toLowerCase()
  const oldDomain = (tenant.domain || '').toLowerCase()

  // Idempotent no-op: already there.
  if (oldSlug === newSlug) {
    return {
      ok: true,
      slug: newSlug,
      domain: oldDomain || newDomain,
      url: `https://${oldDomain || newDomain}`,
      aliasesPreserved: [],
      unchanged: true,
    }
  }

  // Conflict checks: the new slug and the new domain must be free (on OTHER tenants).
  const slugClash = await payload.find({
    collection: 'tenants',
    where: { and: [{ slug: { equals: newSlug } }, { id: { not_equals: tenant.id } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (slugClash.totalDocs > 0) throw new RenameSlugError('that handle is already taken', 'taken')

  const domainClash = await payload.find({
    collection: 'tenants',
    where: {
      and: [
        { or: [{ domain: { equals: newDomain } }, { 'domains.domain': { equals: newDomain } }] },
        { id: { not_equals: tenant.id } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (domainClash.totalDocs > 0) throw new RenameSlugError('that address is already taken', 'taken')

  // Preserve the old subdomain as an alias so links already sent keep resolving.
  const existingAliases = tenant.domains || []
  const haveAlias = new Set(existingAliases.map((d) => d.domain?.toLowerCase()))
  const aliasesPreserved: string[] = []
  const nextAliases = [...existingAliases]
  if (oldDomain && oldDomain !== newDomain && !haveAlias.has(oldDomain)) {
    nextAliases.push({ domain: oldDomain })
    aliasesPreserved.push(oldDomain)
  }

  await payload.update({
    collection: 'tenants',
    id: tenant.id as number,
    data: { slug: newSlug, domain: newDomain, domains: nextAliases } as never,
    overrideAccess: true,
    req,
  })

  // Keep the endeavor's federation domain in step (best-effort, non-fatal).
  try {
    const endeavors = await payload.find({
      collection: 'endeavors',
      where: { tenant: { equals: tenant.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const endeavor = endeavors.docs?.[0] as { id: number | string } | undefined
    if (endeavor) {
      await payload.update({
        collection: 'endeavors',
        id: endeavor.id,
        data: { federation: { networkVisible: true, domain: newDomain } } as never,
        overrideAccess: true,
        req,
      })
    }
  } catch {
    /* endeavor domain sync is non-critical */
  }

  bustTenantCaches([oldSlug, newSlug], [oldDomain, newDomain])

  return {
    ok: true,
    slug: newSlug,
    domain: newDomain,
    url: `https://${newDomain}`,
    aliasesPreserved,
    unchanged: false,
  }
}

/** Map a slug rejection to the RenameSlugError code. */
function RESERVED_OR_INVALID(slug: string): 'reserved' | 'invalid' {
  // vanitySlugRejection already ran; distinguish reserved-word from format here.
  return slug && /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) ? 'reserved' : 'invalid'
}
