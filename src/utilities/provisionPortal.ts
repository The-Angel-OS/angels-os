/**
 * provisionPortal — the canonical "stand up a whole portal enterprise" path.
 *
 * Extracted from the provision-portal endpoint so BOTH the HTTP endpoint
 * (super_admin POST /api/provision-ops/portal) AND LEO's provision_tenant tool
 * call the EXACT same flow. One codebase, every node: a sovereign portal is a
 * tenant + endeavor + default nav/pages + ALL baseline spaces (AI Bus, main,
 * DMs, community) + an admin membership.
 *
 * Idempotent (find-or-create throughout). Runs on the live Payload — no local
 * boot. `req` is optional: the endpoint threads its request (transaction +
 * acting user); LEO calls with just `payload` + `actingUserId`.
 */
import type { Payload, PayloadRequest } from 'payload'
import { findOrCreateTenant, findOrCreateTenantMembership } from '@/endpoints/seed/seed-helpers'
import { createDefaultTenantPages } from '@/utilities/createDefaultTenantPages'
import { createDefaultTenantNavigation } from '@/utilities/createDefaultTenantNavigation'
import { createLexicalContent, createHeadingNode, createParagraphNode } from '@/utilities/lexicalHelpers'
import { ensureTenantSpaces } from '@/utilities/ensureTenantSpaces'
import { ensureTenantDefaults } from '@/utilities/ensureTenantDefaults'
import type { EndeavorType } from '@/utilities/spaceProvisioning'

export interface ProvisionPortalInput {
  /** Display name, e.g. "KenDev". */
  name: string
  /** URL-safe slug; derived from name when omitted. Becomes the tenant identifier. */
  slug?: string
  /** Primary routing domain, e.g. "kendev.co". Required. */
  domain: string
  /** Alias domains that also resolve here, e.g. ["www.kendev.co"]. */
  domainAliases?: string[]
  tagline?: string
  primaryColor?: string
  secondaryColor?: string
  description?: string
  missionStatement?: string
  /** Endeavor type (drives the community space's channel set). */
  endeavorType?: string
}

export interface ProvisionPortalResult {
  ok: boolean
  tenant: { id: number | string; slug: string; domain: string }
  url: string
  log: string[]
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

export async function provisionPortal(
  payload: Payload,
  input: ProvisionPortalInput,
  opts: { req?: PayloadRequest; actingUserId?: number | string } = {},
): Promise<ProvisionPortalResult> {
  const { req, actingUserId } = opts

  const name = input.name?.trim() || 'New Portal'
  const slug = (input.slug?.trim() ? slugify(input.slug) : slugify(name)) || 'portal'
  const domain = input.domain?.trim() || ''
  if (!domain) throw new Error('domain is required')

  const tagline = input.tagline || 'A sovereign node in the Angel OS network'
  const primaryColor = input.primaryColor || '#7AB5B0'
  const secondaryColor = input.secondaryColor || '#9B8EC4'
  const description = input.description || `${name} — a sovereign portal enterprise in the Angel OS federation.`
  const missionStatement = input.missionStatement || `Serve, coordinate, and federate as ${name}.`
  const endeavorType = input.endeavorType || 'creator-content'
  const domainAliases = (input.domainAliases || []).map((d) => d.trim().toLowerCase()).filter(Boolean)

  const log: string[] = []

  // 1. Tenant (canonical helper → correct branding + domain sync)
  const tenant = await findOrCreateTenant(payload, req, {
    name,
    slug,
    domain,
    type: 'tenant',
    branding: { siteName: name, tagline, primaryColor, secondaryColor },
  })
  log.push(`tenant #${tenant.id} (${tenant.slug})`)

  // 1b. Alias domains (e.g. www.) → merge into tenant.domains[], idempotent
  if (domainAliases.length) {
    try {
      const current = (await payload.findByID({
        collection: 'tenants',
        id: tenant.id as number,
        depth: 0,
        overrideAccess: true,
      })) as { domains?: { domain: string }[] | null }
      const existingAliases = current?.domains || []
      const have = new Set(existingAliases.map((d) => d.domain))
      const toAdd = domainAliases.filter((d) => d !== domain && !have.has(d))
      if (toAdd.length) {
        await payload.update({
          collection: 'tenants',
          id: tenant.id as number,
          data: { domains: [...existingAliases, ...toAdd.map((d) => ({ domain: d }))] } as never,
          overrideAccess: true,
          req,
        })
        log.push(`alias domains: +${toAdd.join(', ')}`)
      } else {
        log.push('alias domains: present')
      }
    } catch (e) {
      log.push(`alias domains skipped: ${(e as Error).message}`)
    }
  }

  // 2. Default nav (header + footer)
  try {
    await createDefaultTenantNavigation(payload, tenant.id as number)
    log.push('navigation ready')
  } catch (e) {
    log.push(`navigation skipped: ${(e as Error).message}`)
  }

  // 3. Default pages (home + contact), then a clean command-center hero on home
  await createDefaultTenantPages(payload, tenant.id as number, { siteName: name, tagline })
  const homePages = await payload.find({
    collection: 'pages',
    where: { and: [{ slug: { equals: 'home' } }, { tenant: { equals: tenant.id } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const home = homePages.docs?.[0] as { id: number | string } | undefined
  if (home) {
    await payload.update({
      collection: 'pages',
      id: home.id,
      depth: 0,
      overrideAccess: true,
      data: {
        hero: {
          type: 'lowImpact',
          richText: createLexicalContent([createHeadingNode(name, 'h1'), createParagraphNode(tagline)]),
        },
        meta: { title: `${name} — ${tagline}`, description },
      } as never,
    })
    log.push(`home page #${home.id}`)
  }

  // 4. Endeavor (so the portal appears in Federation Discover as its own node)
  const existingEndeavors = await payload.find({
    collection: 'endeavors',
    where: { tenant: { equals: tenant.id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existingEndeavors.docs.length === 0) {
    const endeavor = await payload.create({
      collection: 'endeavors',
      data: {
        name,
        tagline,
        description,
        endeavorType,
        holonTypes: ['creator'],
        missionStatement,
        status: 'active',
        region: { country: 'US' },
        federation: { networkVisible: true, domain },
        tenant: tenant.id,
      } as never,
      overrideAccess: true,
      req,
    })
    log.push(`endeavor #${endeavor.id}`)
  } else {
    log.push(`endeavor #${existingEndeavors.docs[0]!.id} (existing)`)
  }

  // 4b. Ensure ALL baseline spaces exist: AI Bus + main + DMs + community.
  //     ensureTenantDefaults covers AI Bus (LEO/errors/system-log channels),
  //     main community space, and DMs. ensureTenantSpaces adds the endeavor-
  //     typed community space. Both are idempotent.
  try {
    const d = await ensureTenantDefaults(payload, tenant.id as number)
    log.push(
      `AI Bus: ${d.aiBusSpaceId ?? 'skipped'} | main: ${d.mainSpaceId ?? 'skipped'} | DMs: ${d.dmSpaceId ?? 'skipped'}${d.errors.length ? ` | warn: ${d.errors.join(', ')}` : ''}`,
    )
  } catch (e) {
    log.push(`ensureTenantDefaults skipped: ${(e as Error).message}`)
  }
  try {
    const s = await ensureTenantSpaces(payload, tenant.id as number, {
      endeavorType: endeavorType as EndeavorType,
      spaceName: 'Community',
      req,
    })
    log.push(
      s.createdSpace
        ? `community space #${s.spaceId} created (+ channels)`
        : `space #${s.spaceId} present (backfilled: ${s.addedChannels.join(', ') || 'none'})`,
    )
  } catch (e) {
    log.push(`spaces skipped: ${(e as Error).message}`)
  }

  // 5. Link the acting super_admin as tenant_admin + user.tenants (when known)
  if (actingUserId != null) {
    try {
      await findOrCreateTenantMembership(payload, req, {
        userId: actingUserId,
        tenantId: tenant.id,
        role: 'tenant_admin',
      })
      const fullUser = (await payload.findByID({
        collection: 'users',
        id: actingUserId,
        depth: 0,
        overrideAccess: true,
      })) as { tenants?: { tenant: number | { id: number } }[] }
      const existingTenants = fullUser?.tenants || []
      const linked = existingTenants.some(
        (t) => (typeof t.tenant === 'object' ? t.tenant?.id : t.tenant) === tenant.id,
      )
      if (!linked) {
        await payload.update({
          collection: 'users',
          id: actingUserId,
          data: { tenants: [...existingTenants, { tenant: tenant.id }] } as never,
          overrideAccess: true,
        })
        log.push('linked admin → tenant')
      }
    } catch (e) {
      log.push(`admin link skipped: ${(e as Error).message}`)
    }
  } else {
    log.push('admin link skipped (no acting user)')
  }

  return { ok: true, tenant: { id: tenant.id, slug: tenant.slug, domain }, url: `https://${domain}`, log }
}
