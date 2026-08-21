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
import { verifyEndeavorOnboarding } from '@/utilities/verifyEndeavorOnboarding'
import { ensureTenantContactForm } from '@/utilities/ensureTenantContactForm'
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
  /**
   * Default colour theme for the public site. Omitted keeps 'auto' (follow the
   * visitor's OS). A photography or venue portal wants 'dark' regardless of what
   * the visitor's laptop prefers — the work is the page.
   */
  defaultTheme?: 'auto' | 'light' | 'dark'
  description?: string
  missionStatement?: string
  /** Endeavor type (drives the community space's channel set). */
  endeavorType?: string
  /**
   * Tenant flavor (see AGENTS.md "The model") — 'business' | 'circle' |
   * 'guardian_angel' | 'personal_portal'. Optional; when omitted the tenant keeps
   * the legacy 'tenant' value. `isGuardianAngel: true` implies 'guardian_angel'
   * and wins over this. Never set 'platform' here (that's the reserved root).
   */
  type?: 'business' | 'circle' | 'guardian_angel' | 'personal_portal' | 'tenant'
  /**
   * Marks this as a PERSONAL guardian-angel portal (gmail⇔angel), distinct from a
   * business/ministry portal. Set true by the claim flow so the tenant carries the
   * `isGuardianAngel` marker the claim idempotency reads. Default false.
   */
  isGuardianAngel?: boolean
  /**
   * Whether this portal's endeavor is listed in the federation Discovery tab.
   * Business/ministry portals default TRUE (they WANT to be found). Personal
   * guardian angels pass FALSE — millions of private per-person portals must not
   * flood Discovery. They're still reachable for cross-portal comms (node bus /
   * federated identity); "not listed" ≠ "not connected".
   */
  networkVisible?: boolean
  /**
   * What this portal pays us. Omitted leaves the field alone (existing portals
   * keep theirs; new ones default to 'free' at the collection). Demo sites pass
   * 'demo' — everything switched on, billed to nobody.
   */
  portalPlan?: 'free' | 'site' | 'business' | 'demo'
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
  const networkVisible = input.networkVisible !== false // default true; personal angels pass false
  const domainAliases = (input.domainAliases || []).map((d) => d.trim().toLowerCase()).filter(Boolean)

  const log: string[] = []

  // 1. Tenant (canonical helper → correct branding + domain sync)
  // Flavor (canonical model): a personal guardian portal is a 'guardian_angel';
  // otherwise honor an explicit flavor, else legacy 'tenant'. Never 'platform'.
  const tenantFlavor = input.isGuardianAngel ? 'guardian_angel' : (input.type || 'tenant')
  const tenant = await findOrCreateTenant(payload, req, {
    name,
    slug,
    domain,
    type: tenantFlavor,
    branding: {
      siteName: name,
      tagline,
      primaryColor,
      secondaryColor,
      ...(input.defaultTheme ? { defaultTheme: input.defaultTheme } : {}),
    },
  })
  log.push(`tenant #${tenant.id} (${tenant.slug})`)

  // findOrCreateTenant only brands on CREATE, so a re-run (or a portal that
  // already existed) would silently keep the old theme. Stamp it explicitly.
  if (input.defaultTheme) {
    try {
      const cur = (await payload.findByID({
        collection: 'tenants',
        id: tenant.id as number,
        depth: 0,
        overrideAccess: true,
      })) as { branding?: Record<string, unknown> | null }
      await payload.update({
        collection: 'tenants',
        id: tenant.id as number,
        data: { branding: { ...(cur?.branding || {}), defaultTheme: input.defaultTheme } } as never,
        overrideAccess: true,
        req,
      })
      log.push(`defaultTheme: ${input.defaultTheme}`)
    } catch (e) {
      log.push(`defaultTheme skipped: ${(e as Error).message}`)
    }
  }

  // Stamp the plan. Fail-soft for the same reason as the marker below: a node
  // that has not run the migration yet should still provision a working portal.
  if (input.portalPlan) {
    try {
      await payload.update({
        collection: 'tenants',
        id: tenant.id as number,
        data: { portalPlan: input.portalPlan } as never,
        overrideAccess: true,
        req,
      })
      log.push(`portalPlan: ${input.portalPlan}`)
    } catch (e) {
      log.push(`portalPlan skipped: ${(e as Error).message}`)
    }
  }

  // Stamp the personal-angel marker (fail-soft: a node missing the column just
  // skips it rather than breaking provisioning).
  if (input.isGuardianAngel) {
    try {
      await payload.update({
        collection: 'tenants',
        id: tenant.id as number,
        data: { isGuardianAngel: true } as never,
        overrideAccess: true,
        req,
      })
      log.push('marked isGuardianAngel')
    } catch (e) {
      log.push(`isGuardianAngel mark skipped: ${(e as Error).message}`)
    }
  }

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
        federation: { networkVisible, domain },
        tenant: tenant.id,
      } as never,
      overrideAccess: true,
      req,
    })
    log.push(`endeavor #${endeavor.id}`)
  } else {
    const existing = existingEndeavors.docs[0]!
    // Create-only branding is how defaultTheme silently failed to apply on a
    // re-run, and networkVisible has the same shape — it also drives the
    // force-primary Discovery link, so a stale `true` puts Discovery in a
    // client's nav no matter what the caller asked for. Stamp it whenever the
    // caller was explicit; stay silent when they weren't.
    if (input.networkVisible !== undefined) {
      try {
        const cur = (existing as { federation?: Record<string, unknown> | null }).federation || {}
        await payload.update({
          collection: 'endeavors',
          id: existing.id,
          data: { federation: { ...cur, networkVisible, domain } } as never,
          overrideAccess: true,
          req,
        })
        log.push(`endeavor #${existing.id} (existing, networkVisible: ${networkVisible})`)
      } catch (e) {
        log.push(`endeavor #${existing.id} (existing, networkVisible unchanged: ${(e as Error).message})`)
      }
    } else {
      log.push(`endeavor #${existing.id} (existing)`)
    }
  }

  // 4a2. Wire the real Form Builder contact form (submissions route to LEO via
  //      the AI Bus). Idempotent; non-fatal so provisioning never fails on it.
  try {
    const cf = await ensureTenantContactForm(payload, tenant.id, req)
    log.push(`contact form: ${cf.note}`)
  } catch (e) {
    log.push(`contact form skipped: ${(e as Error).message}`)
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
    // Personal/guardian portals get a PERSONAL space (timeline/journal/reminders),
    // sorted separate from a business endeavor's community hub.
    const personal = input.isGuardianAngel === true
    const s = await ensureTenantSpaces(payload, tenant.id as number, {
      endeavorType: endeavorType as EndeavorType,
      spaceName: personal ? 'My Space' : 'Community',
      personal,
      req,
    })
    log.push(
      s.createdSpace
        ? `${personal ? 'personal' : 'community'} space #${s.spaceId} created (+ channels)`
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
      // VERIFY-AFTER-WRITE: under pool starvation the create above can report
      // success in JS yet ROLL BACK — its operation transaction sits idle while
      // afterChange hooks run on other connections, and PgBouncer terminates it
      // (idle-in-transaction timeout → 260709 guardian incident: the owner
      // membership evaporated, so claim idempotency minted duplicates). Re-check
      // on a fresh operation and retry once WITHOUT req before declaring victory.
      const verifyMembership = async (): Promise<boolean> => {
        const check = await payload.find({
          collection: 'tenant-memberships',
          where: { and: [{ user: { equals: actingUserId } }, { tenant: { equals: tenant.id } }] },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        return check.docs.length > 0
      }
      if (!(await verifyMembership())) {
        await findOrCreateTenantMembership(payload, undefined, {
          userId: actingUserId,
          tenantId: tenant.id,
          role: 'tenant_admin',
        })
        log.push(
          (await verifyMembership())
            ? 'owner membership self-healed (first write rolled back)'
            : 'OWNER MEMBERSHIP MISSING after retry — run verify-onboarding',
        )
      } else {
        log.push('owner membership verified')
      }
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

  // 6. Final onboarding assertion — idempotent self-heal. Confirms AI Bus/Main/DM
  //    spaces, re-homes page channels onto the AI Bus, and backfills space-
  //    memberships for every active member (incl. the admin just linked above).
  try {
    const v = await verifyEndeavorOnboarding(payload, tenant.id as number)
    log.push(
      `onboarding verified: ${v.spacesCount} spaces, ${v.membersCount} members, ` +
        `${v.membersBackfilled} memberships backfilled, ${v.pageChannelsReparented} page channels re-homed` +
        `${v.errors.length ? ` | warn: ${v.errors.join(', ')}` : ''}`,
    )
  } catch (e) {
    log.push(`onboarding verify skipped: ${(e as Error).message}`)
  }

  return { ok: true, tenant: { id: tenant.id, slug: tenant.slug, domain }, url: `https://${domain}`, log }
}
