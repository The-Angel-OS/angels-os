/**
 * Provision Tom Stalcup for Congress tenant on the live database.
 *
 * Usage: pnpm tsx scripts/provision-stalcup.ts
 *
 * This creates the tenant, space, LEO agent, endeavor, posts, and products
 * WITHOUT re-seeding — all existing content (posts, media, products) for
 * other tenants is preserved.
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { USE_CASE_TENANTS } from '../src/endpoints/seed/use-case-tenants'
import {
  findOrCreateTenant,
  findOrCreateSystemAgent,
  findOrCreateTenantMembership,
  findOrCreateCategory,
} from '../src/endpoints/seed/seed-helpers'
import { createSpaceFromTemplate } from '../src/utilities/spaceProvisioning'
import { createDefaultTenantPages } from '../src/utilities/createDefaultTenantPages'
import { createDefaultTenantNavigation } from '../src/utilities/createDefaultTenantNavigation'
import { buildRichText } from '../src/utilities/buildRichText'

async function main() {
  const payload = await getPayload({ config })
  const req = { payload } as any

  const uc = USE_CASE_TENANTS.find((t) => t.slug === 'tomstalcup')
  if (!uc) {
    console.error('Tom Stalcup tenant definition not found in USE_CASE_TENANTS')
    process.exit(1)
  }

  console.log(`\n═══ Provisioning: ${uc.name} (${uc.slug}) ═══\n`)

  // 1. Create tenant
  const tenant = await findOrCreateTenant(payload, req, {
    name: uc.name,
    slug: uc.slug,
    domain: uc.domain,
    type: 'tenant',
    branding: uc.branding,
  })
  const tenantId = tenant.id as number
  console.log(`✓ Tenant: ${tenant.name} (${tenant.slug}) id=${tenantId}`)

  // Set business type and status
  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: {
      status: 'active',
      businessType: uc.businessType,
      storefront: {
        description: uc.description,
        contact: {
          email: uc.operator?.email,
          phone: '(877) 943-4328',
          address: '233 Harvard St. Suite 316, Brookline, MA 02446',
        },
        socialLinks: {
          twitter: 'https://twitter.com/tomstalcup',
          instagram: 'https://instagram.com/tomstalcup',
        },
      },
    } as any,
    overrideAccess: true,
  })
  console.log(`✓ Tenant configured with branding and contact info`)

  // 2. Create space
  const { spaceId } = await createSpaceFromTemplate(
    payload,
    uc.endeavorType,
    tenantId,
    uc.spaceName,
    req,
  )
  console.log(`✓ Space: ${uc.spaceName} id=${spaceId}`)

  // 3. Create default pages and navigation
  try {
    await createDefaultTenantPages(payload, tenantId, {
      siteName: uc.branding.siteName,
      tagline: uc.branding.tagline,
    })
    console.log(`✓ Default pages created`)
  } catch (err) {
    console.warn(`⚠ Pages (non-fatal): ${err}`)
  }

  try {
    await createDefaultTenantNavigation(payload, tenantId)
    console.log(`✓ Default navigation created`)
  } catch (err) {
    console.warn(`⚠ Navigation (non-fatal): ${err}`)
  }

  // 4. Create LEO agent
  await findOrCreateSystemAgent(payload, req, {
    tenantId,
    tenantSlug: uc.slug,
    agentType: 'leo',
    displayName: 'Nimue',
    personality: uc.leoPersonality,
  })
  console.log(`✓ LEO agent created`)

  // 5. Create Endeavor record
  try {
    const existing = await payload.find({
      collection: 'endeavors',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length === 0) {
      await payload.create({
        collection: 'endeavors',
        data: {
          name: uc.name,
          endeavorType: uc.endeavorType,
          tagline: uc.tagline,
          description: uc.description,
          holonTypes: uc.holonTypes,
          missionStatement: uc.missionStatement,
          status: 'active',
          region: uc.region,
          operator: uc.operator
            ? { name: uc.operator.name, email: uc.operator.email, role: uc.operator.role }
            : undefined,
          capabilities: uc.capabilities?.map((c) => ({
            skill: c.skill,
            description: c.description,
          })),
          federation: { networkVisible: true },
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      console.log(`✓ Endeavor record created (network visible)`)
    } else {
      console.log(`✓ Endeavor already exists`)
    }
  } catch (err) {
    console.warn(`⚠ Endeavor (non-fatal): ${err}`)
  }

  // 6. Link admin user
  const adminUser = await payload.find({
    collection: 'users',
    where: { email: { equals: 'kenneth@kendev.co' } },
    limit: 1,
    overrideAccess: true,
  })
  if (adminUser.docs[0]) {
    await findOrCreateTenantMembership(payload, req, {
      userId: adminUser.docs[0].id,
      tenantId,
      role: 'tenant_admin',
    })
    console.log(`✓ Admin user linked as tenant_admin`)
  }

  // 7. Seed posts
  const category = await findOrCreateCategory(payload, req, {
    title: 'Campaign',
    slug: 'campaign',
    tenantId,
  })
  for (const post of uc.posts) {
    const existing = await payload.find({
      collection: 'posts',
      where: {
        slug: { equals: post.slug },
        tenant: { equals: tenantId },
      },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length === 0) {
      await payload.create({
        collection: 'posts',
        depth: 0,
        data: {
          title: post.title,
          slug: post.slug,
          _status: 'published',
          publishedOn: new Date(),
          hero: { type: 'lowImpact' },
          layout: [
            { blockType: 'content', columns: [{ size: 'full', richText: buildRichText([post.excerpt]), enableLink: false }] },
            { blockType: 'comments', heading: 'Comments' },
          ],
          meta: { title: post.title, description: post.excerpt },
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      console.log(`  ✓ Post: ${post.title}`)
    }
  }

  // 8. Seed products
  if (uc.products) {
    for (const prod of uc.products) {
      const existing = await payload.find({
        collection: 'products',
        where: {
          slug: { equals: prod.slug },
          tenant: { equals: tenantId },
        },
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs.length === 0) {
        await payload.create({
          collection: 'products',
          data: {
            title: prod.title,
            slug: prod.slug,
            description: buildRichText(prod.description),
            price: prod.priceInUSD,
            currency: 'usd',
            _status: 'published',
            tenant: tenantId,
            ...(prod.productionType ? { productionType: prod.productionType } : {}),
            ...(prod.networkListing != null
              ? { networkListing: prod.networkListing }
              : {}),
          } as any,
          overrideAccess: true,
        })
        console.log(`  ✓ Product: ${prod.title}`)
      }
    }
  }

  console.log(`\n═══ Done! Tom Stalcup tenant is live at ${uc.domain} ═══\n`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
