import type { CollectionSlug, Payload, PayloadRequest, File } from 'payload'

import { deleteMediaFromVercelBlob } from '@/utilities/deleteMediaFromVercelBlob'
import { createSpaceFromTemplate } from '@/utilities/spaceProvisioning'

import { contactFormData } from './contact-form'
import { contactPageData } from './contact-page'
import { productHatData } from './product-hat'
import { productTshirtData, productTshirtVariant } from './product-tshirt'
import { homePageData } from './home'
import { imageHatData } from './image-hat'
import { imageTshirtBlackData } from './image-tshirt-black'
import { imageTshirtWhiteData } from './image-tshirt-white'
import { imageHero1Data } from './image-hero-1'
import { Address, Transaction, VariantOption } from '@/payload-types'
import { angelOsTemplate, angelOsSupportTemplate, applySpaceTemplate } from './spaces-template'
import { USE_CASE_TENANTS } from './use-case-tenants'
import {
  DEFAULT_TENANT_SLUG,
  findOrCreateTenant,
  findOrCreateTenantMembership,
  findOrCreateUser,
  findOrCreateLeoUser,
  findOrCreateSpaceMembership,
  seedPlatformTenant,
  seedArchangelLeo,
  INITIAL_USER_EMAILS,
} from './seed-helpers'

// Order matters: tenant-scoped collections first. Exclude tenants and users—handled via findOrCreate.
const collections: CollectionSlug[] = [
  'categories',
  'comments',
  'media',
  'pages',
  'posts',
  'products',
  'forms',
  'form-submissions',
  'variants',
  'variantOptions',
  'variantTypes',
  'carts',
  'transactions',
  'addresses',
  'orders',
  'header',
  'footer',
  'messages',
  'channels',
  'space-memberships',
  'tenant-memberships',
  'spaces',
  // tenants, users: not cleared; use findOrCreate
]

const categories = ['Accessories', 'T-Shirts', 'Hats']

const sizeVariantOptions = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' },
  { label: 'X Large', value: 'xlarge' },
]

const colorVariantOptions = [
  { label: 'Black', value: 'black' },
  { label: 'White', value: 'white' },
]

const baseAddressUSData: Transaction['billingAddress'] = {
  title: 'Dr.',
  firstName: 'Otto',
  lastName: 'Octavius',
  phone: '1234567890',
  company: 'Oscorp',
  addressLine1: '123 Main St',
  addressLine2: 'Suite 100',
  city: 'New York',
  state: 'NY',
  postalCode: '10001',
  country: 'US',
}

const baseAddressUKData: Transaction['billingAddress'] = {
  title: 'Mr.',
  firstName: 'Oliver',
  lastName: 'Twist',
  phone: '1234567890',
  addressLine1: '48 Great Portland St',
  city: 'London',
  postalCode: 'W1W 7ND',
  country: 'GB',
}

const adminAddressData = {
  title: 'Mr.',
  firstName: 'Admin',
  lastName: 'User',
  phone: '',
  addressLine1: '2566 Harn Blvd',
  addressLine2: 'Apt 13',
  city: 'Clearwater',
  state: 'FL',
  postalCode: '33764',
  country: 'US' as const,
}

/** Helper to build Lexical richText from plain paragraphs */
function buildRichText(paragraphs: string[]) {
  return {
    root: {
      type: 'root',
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        children: [
          { type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      })),
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

// Next.js revalidation errors are normal when seeding the database without a server running
// i.e. running `yarn seed` locally instead of using the admin UI within an active app
// The app is not running to revalidate the pages and so the API routes are not available
// These error messages can be ignored: `Error hitting revalidate route for...`
export const seed = async ({
  payload,
  req,
}: {
  payload: Payload
  req: PayloadRequest
}): Promise<void> => {
  payload.logger.info('Seeding database...')

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: Platform Infrastructure
  // ═══════════════════════════════════════════════════════════════

  const platformTenant = await seedPlatformTenant(payload, req)
  const platformTenantId = platformTenant.id
  payload.logger.info(`— Platform Tenant: ${platformTenant.name} (${platformTenant.slug}) id=${platformTenantId}`)

  const archangelLeo = await seedArchangelLeo(payload, req, platformTenantId)
  payload.logger.info(`— Archangel LEO: ${archangelLeo.email} id=${archangelLeo.id}`)

  const defaultTenant = await findOrCreateTenant(payload, req, {
    name: 'Angel OS',
    slug: DEFAULT_TENANT_SLUG,
    domain: 'localhost',
    type: 'tenant',
    branding: {
      siteName: 'Angel OS',
      tagline: 'Ready Player Everyone',
      primaryColor: '#10B981',
      secondaryColor: '#0078D4',
      accentColor: '#FF6B35',
      backgroundColor: '#FFFFFF',
      foregroundColor: '#1A1A1A',
      borderColor: '#E5E7EB',
      headingFont: 'inter',
      bodyFont: 'inter',
    },
  })
  const defaultTenantId = defaultTenant.id as number
  payload.logger.info(`— Default Tenant: ${defaultTenant.name} (${defaultTenant.slug}) id=${defaultTenantId}`)

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: Clear Collections
  // ═══════════════════════════════════════════════════════════════

  payload.logger.info(`— Clearing collections (excluding tenants, users)...`)

  const existingMedia = await payload.find({
    collection: 'media',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
    select: { id: true, url: true, filename: true },
  })
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN
  for (const doc of existingMedia.docs) {
    const mediaDoc = doc as { id: number; url?: string | null; filename?: string | null }
    if (mediaDoc.url) {
      await deleteMediaFromVercelBlob(mediaDoc.url, blobToken)
    }
    await payload.delete({ collection: 'media', id: mediaDoc.id, req, overrideAccess: true })
  }

  for (const collection of collections) {
    await payload.db.deleteMany({ collection, req, where: {} })
    if (payload.collections[collection].config.versions) {
      await payload.db.deleteVersions({ collection, req, where: {} })
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 3: Users & Memberships
  // ═══════════════════════════════════════════════════════════════

  payload.logger.info(`— Seeding initial users...`)

  const adminUser = await findOrCreateUser(payload, req, {
    email: INITIAL_USER_EMAILS.admin,
    name: 'Angel OS Admin',
    password: 'angelos',
    roles: ['super_admin', 'customer'],
    tenantId: defaultTenantId,
  })
  const adminUserId = adminUser.id as number
  payload.logger.info(`— Admin user: ${adminUser.email} id=${adminUserId}`)

  const customerUser = await findOrCreateUser(payload, req, {
    email: INITIAL_USER_EMAILS.customer,
    name: 'Customer',
    password: 'password',
    roles: ['customer'],
  })
  const customerUserId = customerUser.id as number
  payload.logger.info(`— Customer user: ${customerUser.email} id=${customerUserId}`)

  await findOrCreateTenantMembership(payload, req, {
    userId: adminUserId,
    tenantId: defaultTenantId,
    role: 'tenant_admin',
  })

  const leoUser = await findOrCreateLeoUser(payload, req, {
    tenantId: defaultTenantId,
    tenantSlug: defaultTenant.slug,
    displayName: 'LEO',
  })
  payload.logger.info(`— LEO system agent: ${leoUser.email} id=${leoUser.id}`)

  // ═══════════════════════════════════════════════════════════════
  // PHASE 4: Default Tenant Spaces (legacy template)
  // ═══════════════════════════════════════════════════════════════

  const { spaceId, channelNames, messageCount } = await applySpaceTemplate(
    payload, defaultTenantId, angelOsTemplate, adminUserId, req,
  )
  payload.logger.info(`— Angel OS Community space: ${spaceId}, ${channelNames.length} channels, ${messageCount} messages`)

  const { spaceId: supportSpaceId } = await applySpaceTemplate(
    payload, defaultTenantId, angelOsSupportTemplate, adminUserId, req,
  )
  payload.logger.info(`— Angel OS Support space: ${supportSpaceId}`)

  await findOrCreateSpaceMembership(payload, req, { userId: adminUserId, spaceId, role: 'space_admin' })
  await findOrCreateSpaceMembership(payload, req, { userId: adminUserId, spaceId: supportSpaceId, role: 'space_admin' })

  // ═══════════════════════════════════════════════════════════════
  // PHASE 5: Use-Case Tenants (exercises provisioning engine)
  // ═══════════════════════════════════════════════════════════════

  payload.logger.info(`\n═══ Provisioning ${USE_CASE_TENANTS.length} use-case tenants ═══`)

  for (const uc of USE_CASE_TENANTS) {
    payload.logger.info(`\n— Provisioning: ${uc.name} (${uc.endeavorType})`)

    const tenant = await findOrCreateTenant(payload, req, {
      name: uc.name, slug: uc.slug, domain: uc.domain, type: 'tenant', branding: uc.branding,
    })
    payload.logger.info(`  ✓ Tenant: ${tenant.name} id=${tenant.id}`)

    const leoAgent = await findOrCreateLeoUser(payload, req, {
      tenantId: tenant.id, tenantSlug: uc.slug, displayName: 'LEO',
    })
    payload.logger.info(`  ✓ LEO: ${leoAgent.email}`)

    // Exercise createSpaceFromTemplate — the provisioning engine
    const { spaceId: ucSpaceId, channelIds } = await createSpaceFromTemplate(
      payload, uc.endeavorType, tenant.id, uc.spaceName, req,
    )
    payload.logger.info(`  ✓ Space: "${uc.spaceName}" (${channelIds.length} channels)`)

    await findOrCreateTenantMembership(payload, req, { userId: adminUserId, tenantId: tenant.id, role: 'tenant_admin' })
    await findOrCreateSpaceMembership(payload, req, { userId: adminUserId, spaceId: ucSpaceId, role: 'space_admin' })

    // Seed posts for this tenant
    for (const p of uc.posts) {
      await payload.create({
        collection: 'posts',
        depth: 0,
        data: {
          title: p.title,
          slug: p.slug,
          _status: 'published',
          publishedOn: new Date(),
          hero: { type: 'lowImpact' },
          layout: [
            { blockType: 'content', columns: [{ size: 'full', richText: buildRichText([p.excerpt]), enableLink: false }] },
            { blockType: 'comments', heading: 'Comments' },
          ],
          meta: { description: p.excerpt, title: p.title },
          tenant: tenant.id as number,
        } as any,
      })
    }
    payload.logger.info(`  ✓ ${uc.posts.length} posts`)

    // Header/footer for this tenant
    await Promise.all([
      payload.create({
        collection: 'header',
        data: {
          tenant: tenant.id as number,
          navItems: [
            { link: { type: 'custom' as const, label: 'Home', url: '/' } },
            { link: { type: 'custom' as const, label: 'Shop', url: '/shop' } },
            { link: { type: 'custom' as const, label: 'Posts', url: '/posts' } },
            { link: { type: 'custom' as const, label: 'Account', url: '/account' } },
          ],
        },
        depth: 0,
      }),
      payload.create({
        collection: 'footer',
        data: {
          tenant: tenant.id as number,
          navItems: [
            { link: { type: 'custom' as const, label: 'Dashboard', url: '/dashboard' } },
            { link: { type: 'custom' as const, label: 'Angel OS', newTab: true, url: 'https://github.com/The-Angel-OS/angels-os' } },
          ],
        },
        depth: 0,
      }),
    ])
  }

  payload.logger.info(`\n═══ Use-case tenants complete ═══\n`)

  // ═══════════════════════════════════════════════════════════════
  // PHASE 6: Default Tenant Media & Products
  // ═══════════════════════════════════════════════════════════════

  payload.logger.info(`— Seeding media...`)

  const [imageHatBuffer, imageTshirtBlackBuffer, imageTshirtWhiteBuffer, heroBuffer] =
    await Promise.all([
      fetchFileByURL('https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/ecommerce/src/endpoints/seed/hat-logo.png'),
      fetchFileByURL('https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/ecommerce/src/endpoints/seed/tshirt-black.png'),
      fetchFileByURL('https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/ecommerce/src/endpoints/seed/tshirt-white.png'),
      fetchFileByURL('https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-hero1.webp'),
    ])

  const [imageHat, imageTshirtBlack, imageTshirtWhite, imageHero, accessoriesCategory, tshirtsCategory, hatsCategory] =
    await Promise.all([
      payload.create({ collection: 'media', data: { ...imageHatData, tenant: defaultTenantId }, file: imageHatBuffer }),
      payload.create({ collection: 'media', data: { ...imageTshirtBlackData, tenant: defaultTenantId }, file: imageTshirtBlackBuffer }),
      payload.create({ collection: 'media', data: { ...imageTshirtWhiteData, tenant: defaultTenantId }, file: imageTshirtWhiteBuffer }),
      payload.create({ collection: 'media', data: { ...imageHero1Data, tenant: defaultTenantId }, file: heroBuffer }),
      ...categories.map((category) =>
        payload.create({ collection: 'categories', data: { title: category, slug: category, tenant: defaultTenantId } }),
      ),
    ])

  payload.logger.info(`— Seeding variant types and options...`)

  const sizeVariantType = await payload.create({ collection: 'variantTypes', data: { name: 'size', label: 'Size' } })
  const sizeVariantOptionsResults: VariantOption[] = []
  for (const option of sizeVariantOptions) {
    const result = await payload.create({ collection: 'variantOptions', data: { ...option, variantType: sizeVariantType.id } })
    sizeVariantOptionsResults.push(result)
  }
  const [small, medium, large, xlarge] = sizeVariantOptionsResults

  const colorVariantType = await payload.create({ collection: 'variantTypes', data: { name: 'color', label: 'Color' } })
  const [black, white] = await Promise.all(
    colorVariantOptions.map((option) =>
      payload.create({ collection: 'variantOptions', data: { ...option, variantType: colorVariantType.id } }),
    ),
  )

  payload.logger.info(`— Seeding products...`)

  const productHat = await payload.create({
    collection: 'products',
    depth: 0,
    data: {
      ...productHatData({ galleryImage: imageHat, metaImage: imageHat, variantTypes: [colorVariantType], categories: [hatsCategory], relatedProducts: [] }),
      tenant: defaultTenantId,
    },
  })

  const productTshirt = await payload.create({
    collection: 'products',
    depth: 0,
    data: {
      ...productTshirtData({
        galleryImages: [{ image: imageTshirtBlack, variantOption: black }, { image: imageTshirtWhite, variantOption: white }],
        metaImage: imageTshirtBlack,
        contentImage: imageHero,
        variantTypes: [colorVariantType, sizeVariantType],
        categories: [tshirtsCategory],
        relatedProducts: [productHat],
      }),
      tenant: defaultTenantId,
    },
  })

  const [smallTshirtHoodieVariant, mediumTshirtHoodieVariant, largeTshirtHoodieVariant, xlargeTshirtHoodieVariant] =
    await Promise.all(
      [small, medium, large, xlarge].map((vo) =>
        payload.create({ collection: 'variants', depth: 0, data: productTshirtVariant({ product: productTshirt, variantOptions: [vo, white] }) }),
      ),
    )

  await Promise.all(
    [small, medium, large, xlarge].map((vo) =>
      payload.create({
        collection: 'variants',
        depth: 0,
        data: productTshirtVariant({ product: productTshirt, variantOptions: [vo, black], ...(vo.value === 'medium' ? { inventory: 0 } : {}) }),
      }),
    ),
  )

  payload.logger.info(`— Seeding contact form...`)
  const contactForm = await payload.create({ collection: 'forms', depth: 0, data: contactFormData() })

  // ═══════════════════════════════════════════════════════════════
  // PHASE 7: Default Tenant Pages & Posts
  // ═══════════════════════════════════════════════════════════════

  payload.logger.info(`— Seeding pages...`)

  await Promise.all([
    payload.create({ collection: 'pages', depth: 0, data: { ...homePageData({ contentImage: imageHero, metaImage: imageHat }), tenant: defaultTenantId } }),
    payload.create({ collection: 'pages', depth: 0, data: { ...contactPageData({ contactForm }), tenant: defaultTenantId } }),
  ])

  payload.logger.info(`— Seeding Angel OS posts...`)

  const angelOsPosts = [
    {
      title: 'Welcome to Angel OS',
      slug: 'welcome-to-angel-os',
      excerpt: 'Introducing Angel OS — Sovereign Intelligence for your digital presence.',
      paragraphs: [
        'Angel OS is an inversion of the Daemon — bringing sovereign intelligence to everyone. Each tenant has their own LEO (Learning, Engaging, Organizing) assistant that learns, engages, and organizes on their behalf.',
        'Unlike traditional SaaS platforms that treat businesses as rows in a database, Angel OS gives every endeavor its own sovereign AI angel. Your data stays yours. Your AI serves you. The platform is just infrastructure.',
        'Explore the Shop for products, join Spaces for community, and connect with LEO for AI-powered assistance. Welcome to the future of business software — where AI actually likes people.',
      ],
    },
    {
      title: 'Getting Started with Spaces',
      slug: 'getting-started-with-spaces',
      excerpt: 'Learn how to navigate and participate in Angel OS Spaces.',
      paragraphs: [
        'Spaces are Discord-like workspaces where you can join channels, collaborate, and connect with LEO. Each tenant can have multiple Spaces — from community hubs to support channels.',
        'When a new tenant is provisioned, the system automatically creates spaces based on the chosen endeavor type. A service provider gets booking and client channels. A retailer gets product and order channels. Everything is tailored to how you work.',
        'Channels within spaces support different types of communication: general discussion, announcements, support tickets, sales inquiries, and more. LEO monitors each channel and can respond contextually based on routing rules.',
      ],
    },
    {
      title: 'The Angel OS Constitution',
      slug: 'the-angel-os-constitution',
      excerpt: 'How constitutional governance ensures fairness, transparency, and dignity in every interaction.',
      paragraphs: [
        'Angel OS is governed by a constitution — a binding set of principles that every angel must follow. This is not a terms of service. This is a social contract between the platform and every human it serves.',
        'Article I guarantees sovereignty: your data is yours, your AI serves you, and you can export everything at any time. No vendor lock-in. No dark patterns. No surveillance capitalism.',
        'Article II establishes the Ultimate Fair economic model: 60% to the creator, 20% to the platform, 15% to contributors, and 5% to the Justice Fund. Every transaction follows this split automatically through Stripe Connect.',
        'Article III defines anti-demonic safeguards: no dark patterns, no exploitation, no attention manipulation. Every error message is encouraging. Every empty state is warm. The whole point of existence is to learn to love.',
      ],
    },
    {
      title: 'Understanding LEO: Your AI Angel',
      slug: 'understanding-leo',
      excerpt: 'Meet LEO — Learning, Engaging, Organizing. Your sovereign AI assistant that actually works for you.',
      paragraphs: [
        'LEO stands for Learning, Engaging, Organizing. Every tenant gets their own LEO instance that learns their business, engages with their customers, and organizes their operations.',
        'Unlike chatbots that follow scripts, LEO has real capabilities: it can create blog posts, manage products, answer customer questions, and coordinate with other angels across the platform through the AI Bus.',
        'The key architectural principle: users bring their own AI keys. Angel OS is infrastructure, not an AI provider. You choose your model — Claude, GPT-4, Llama, Mistral — through a unified API gateway. Your AI, your choice.',
        'At the platform level, Archangel LEO orchestrates the entire constellation: provisioning new tenants, monitoring health, generating platform content, and ensuring constitutional compliance across all angels.',
      ],
    },
    {
      title: 'Five Business Types, One Platform',
      slug: 'five-business-types',
      excerpt: 'From massage parlors to cactus farms — how Angel OS provisions for any endeavor type.',
      paragraphs: [
        'Angel OS supports five endeavor types out of the box, each with a tailored provisioning template that creates the right spaces, channels, and workflows for your business.',
        'Service Providers (massage, consulting, cleaning) get booking channels, client request tracking, portfolio showcases, and review collection. Your angel helps manage appointments and follow up with clients.',
        'Retail Commerce (farms, shops, equipment) get product catalogs, order tracking, and customer support channels. LEO can generate product descriptions, answer stock questions, and process inquiries.',
        'Creator and Content businesses (tours, coaching, courses) get community spaces, content update channels, and premium subscriber areas. Perfect for creators who want to build a loyal audience.',
        'Booking-Based businesses (booth rentals, consulting, salons) get scheduling, consultation management, and availability channels. The calendar integration handles the complexity.',
        'Custom endeavors start with the basics and build from there. Angel OS is a canvas — paint whatever you need.',
      ],
    },
    {
      title: 'The Provisioning Engine',
      slug: 'the-provisioning-engine',
      excerpt: 'How Angel OS creates a fully functional business presence in under 30 seconds.',
      paragraphs: [
        'When a new tenant is provisioned through the Admin Panel wizard, the provisioning engine executes a choreographed sequence: create tenant, assign branding, spawn LEO agent, build spaces from template, create channels, seed initial messages, configure header and footer.',
        'The entire process takes less than 30 seconds. By the time the admin refreshes the dashboard, the new tenant is live with a complete working infrastructure.',
        'The Suitcase Manager takes this further: export any tenant as a portable JSON package (with constitutional metadata validation) and import it into another Angel OS instance. This is how the federation will work — angels can travel between dioceses.',
        'Every export includes an anti-demonic safeguard check. The constitutional metadata must be present and valid. No angel leaves home without its constitution.',
      ],
    },
  ]

  for (const post of angelOsPosts) {
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
          { blockType: 'content', columns: [{ size: 'full', richText: buildRichText(post.paragraphs), enableLink: false }] },
          { blockType: 'comments', heading: 'Comments' },
        ],
        meta: { image: imageHero?.id, description: post.excerpt, title: post.title },
        tenant: defaultTenantId,
      } as any,
    })
  }
  payload.logger.info(`— Seeded ${angelOsPosts.length} Angel OS posts`)

  // ═══════════════════════════════════════════════════════════════
  // PHASE 8: E-commerce Sample Data
  // ═══════════════════════════════════════════════════════════════

  payload.logger.info(`— Seeding addresses...`)
  await payload.create({ collection: 'addresses', depth: 0, data: { customer: adminUserId, ...adminAddressData } })
  await payload.create({ collection: 'addresses', depth: 0, data: { customer: customerUserId, ...(baseAddressUSData as Address) } })
  await payload.create({ collection: 'addresses', depth: 0, data: { customer: customerUserId, ...(baseAddressUKData as Address) } })

  payload.logger.info(`— Seeding transactions...`)
  await payload.create({ collection: 'transactions', data: { currency: 'USD', customer: customerUserId, paymentMethod: 'stripe', stripe: { customerID: 'cus_123', paymentIntentID: 'pi_123' }, status: 'pending', billingAddress: baseAddressUSData } })
  const succeededTransaction = await payload.create({ collection: 'transactions', data: { currency: 'USD', customer: customerUserId, paymentMethod: 'stripe', stripe: { customerID: 'cus_123', paymentIntentID: 'pi_123' }, status: 'succeeded', billingAddress: baseAddressUSData } })

  payload.logger.info(`— Seeding carts...`)
  await payload.create({ collection: 'carts', data: { customer: customerUserId, currency: 'USD', items: [{ product: productTshirt.id, variant: mediumTshirtHoodieVariant.id, quantity: 1 }] } })
  await payload.create({ collection: 'carts', data: { currency: 'USD', createdAt: new Date('2023-01-01T00:00:00Z').toISOString(), items: [{ product: productHat.id, quantity: 1 }] } })
  await payload.create({ collection: 'carts', data: { customer: customerUserId, currency: 'USD', purchasedAt: new Date().toISOString(), subtotal: 7499, items: [{ product: productTshirt.id, variant: smallTshirtHoodieVariant.id, quantity: 1 }, { product: productTshirt.id, variant: mediumTshirtHoodieVariant.id, quantity: 1 }] } })

  payload.logger.info(`— Seeding orders...`)
  const orderItems = [{ product: productTshirt.id, variant: smallTshirtHoodieVariant.id, quantity: 1 }, { product: productTshirt.id, variant: mediumTshirtHoodieVariant.id, quantity: 1 }]
  await payload.create({ collection: 'orders', data: { tenant: defaultTenantId, amount: 7499, currency: 'USD', customer: customerUserId, shippingAddress: baseAddressUSData, items: orderItems, status: 'completed', transactions: [succeededTransaction.id] } })
  await payload.create({ collection: 'orders', data: { tenant: defaultTenantId, amount: 7499, currency: 'USD', customer: customerUserId, shippingAddress: baseAddressUSData, items: orderItems, status: 'processing', transactions: [succeededTransaction.id] } })

  // ═══════════════════════════════════════════════════════════════
  // PHASE 9: Default Tenant Header & Footer
  // ═══════════════════════════════════════════════════════════════

  payload.logger.info(`— Seeding header and footer...`)
  await Promise.all([
    payload.create({
      collection: 'header',
      data: {
        tenant: defaultTenantId,
        navItems: [
          { link: { type: 'custom' as const, label: 'Home', url: '/' } },
          { link: { type: 'custom' as const, label: 'Shop', url: '/shop' } },
          { link: { type: 'custom' as const, label: 'Posts', url: '/posts' } },
          { link: { type: 'custom' as const, label: 'Account', url: '/account' } },
        ],
      },
      depth: 0,
    }),
    payload.create({
      collection: 'footer',
      data: {
        tenant: defaultTenantId,
        navItems: [
          { link: { type: 'custom' as const, label: 'Admin', url: '/admin' } },
          { link: { type: 'custom' as const, label: 'Find my order', url: '/find-order' } },
          { link: { type: 'custom' as const, label: 'Source Code', newTab: true, url: 'https://github.com/The-Angel-OS/angels-os' } },
          { link: { type: 'custom' as const, label: 'Payload CMS', newTab: true, url: 'https://payloadcms.com/' } },
        ],
      },
      depth: 0,
    }),
  ])

  // ═══════════════════════════════════════════════════════════════

  const totalTenants = 1 + USE_CASE_TENANTS.length
  const totalPosts = angelOsPosts.length + USE_CASE_TENANTS.reduce((sum, t) => sum + t.posts.length, 0)

  payload.logger.info(`\n${'═'.repeat(60)}`)
  payload.logger.info(`  Angel OS seed complete!`)
  payload.logger.info(`  Platform tenant + ${totalTenants} endeavor tenants`)
  payload.logger.info(`  ${totalPosts} posts across all tenants`)
  payload.logger.info(`  ${USE_CASE_TENANTS.length} endeavor types exercised through provisioning engine`)
  payload.logger.info(`  Archangel LEO + ${totalTenants} tenant LEO agents`)
  payload.logger.info(`${'═'.repeat(60)}\n`)
}

async function fetchFileByURL(url: string): Promise<File> {
  const res = await fetch(url, { credentials: 'include', method: 'GET' })
  if (!res.ok) {
    throw new Error(`Failed to fetch file from ${url}, status: ${res.status}`)
  }
  const data = await res.arrayBuffer()
  return {
    name: url.split('/').pop() || `file-${Date.now()}`,
    data: Buffer.from(data),
    mimetype: `image/${url.split('.').pop()}`,
    size: data.byteLength,
  }
}
