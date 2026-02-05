import type { CollectionSlug, Payload, PayloadRequest, File } from 'payload'

import { deleteMediaFromVercelBlob } from '@/utilities/deleteMediaFromVercelBlob'

import { contactFormData } from './contact-form'
import { contactPageData } from './contact-page'
import { productHatData } from './product-hat'
import { productTshirtData, productTshirtVariant } from './product-tshirt'
import { homePageData } from './home'
import { angelOsPostsData } from './posts'
import { imageHatData } from './image-hat'
import { imageTshirtBlackData } from './image-tshirt-black'
import { imageTshirtWhiteData } from './image-tshirt-white'
import { imageHero1Data } from './image-hero-1'
import { Address, Transaction, VariantOption } from '@/payload-types'
import { angelOsTemplate, angelOsSupportTemplate, applySpaceTemplate } from './spaces-template'
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

  // 1. Platform Tenant: Create the special platform tenant first
  const platformTenant = await seedPlatformTenant(payload, req)
  const platformTenantId = platformTenant.id
  payload.logger.info(`— Platform Tenant: ${platformTenant.name} (${platformTenant.slug}) id=${platformTenantId}`)

  // 2. Archangel LEO: Create the platform-level Archangel
  const archangelLeo = await seedArchangelLeo(payload, req, platformTenantId)
  const archangelLeoId = archangelLeo.id
  payload.logger.info(`— Archangel LEO: ${archangelLeo.email} id=${archangelLeoId}`)

  // 3. Default Tenant: find or create (tenants not cleared)
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

  // 2. Clear collections (excluding tenants, users)
  payload.logger.info(`— Clearing collections (excluding tenants, users)...`)

  // Delete media: (1) remove from Vercel Blob storage, (2) remove from DB.
  // We explicitly call del() on each blob URL because payload.db.deleteMany bypasses
  // storage adapter hooks - blobs would otherwise remain in hosted storage.
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

  payload.logger.info(`— Seeding initial users...`)

  // Admin user: find or create (users not cleared)
  const adminUser = await findOrCreateUser(payload, req, {
    email: INITIAL_USER_EMAILS.admin,
    name: 'Angel OS Admin',
    password: 'angelos',
    roles: ['super_admin', 'customer'],
    tenantId: defaultTenantId,
  })
  const adminUserId = adminUser.id as number
  payload.logger.info(`— Admin user: ${adminUser.email} id=${adminUserId}`)

  // Customer user: find or create
  const customerUser = await findOrCreateUser(payload, req, {
    email: INITIAL_USER_EMAILS.customer,
    name: 'Customer',
    password: 'password',
    roles: ['customer'],
  })
  const customerUserId = customerUser.id as number
  payload.logger.info(`— Customer user: ${customerUser.email} id=${customerUserId}`)

  // TenantMembership: admin as tenant_admin (find or create)
  await findOrCreateTenantMembership(payload, req, {
    userId: adminUserId,
    tenantId: defaultTenantId,
    role: 'tenant_admin',
  })
  payload.logger.info(`— TenantMembership for admin (tenant_admin of Angel OS)`)

  // LEO system agent (AI avatar) for this tenant
  // Initially just LEO, but architecture supports multiple agents (support, sales, etc.)
  const leoUser = await findOrCreateLeoUser(payload, req, {
    tenantId: defaultTenantId,
    tenantSlug: defaultTenant.slug,
    displayName: 'LEO',
  })
  const leoUserId = leoUser.id as number
  payload.logger.info(`— LEO system agent: ${leoUser.email} id=${leoUserId}`)

  // Apply space template: creates Space, Channels, and Messages (cleared above)
  const { spaceId, channelNames, messageCount } = await applySpaceTemplate(
    payload,
    defaultTenantId,
    angelOsTemplate,
    adminUserId,
    req,
  )
  payload.logger.info(
    `— Applied Angel OS space template: space ${spaceId}, ${channelNames.length} channels, ${messageCount} messages`,
  )

  // Second space: tenant can have multiple spaces
  const { spaceId: supportSpaceId } = await applySpaceTemplate(
    payload,
    defaultTenantId,
    angelOsSupportTemplate,
    adminUserId,
    req,
  )
  payload.logger.info(`— Applied Angel OS Support space: ${supportSpaceId}`)
  await findOrCreateSpaceMembership(payload, req, {
    userId: adminUserId,
    spaceId: supportSpaceId,
    role: 'space_admin',
  })

  // SpaceMembership: admin as space_admin (find or create)
  await findOrCreateSpaceMembership(payload, req, {
    userId: adminUserId,
    spaceId,
    role: 'space_admin',
  })
  payload.logger.info(`— SpaceMembership for admin (space_admin of Angel OS Community)`)

  payload.logger.info(`— Seeding media...`)

  const [imageHatBuffer, imageTshirtBlackBuffer, imageTshirtWhiteBuffer, heroBuffer] =
    await Promise.all([
      fetchFileByURL(
        'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/ecommerce/src/endpoints/seed/hat-logo.png',
      ),
      fetchFileByURL(
        'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/ecommerce/src/endpoints/seed/tshirt-black.png',
      ),
      fetchFileByURL(
        'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/ecommerce/src/endpoints/seed/tshirt-white.png',
      ),
      fetchFileByURL(
        'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-hero1.webp',
      ),
    ])

  const [
    imageHat,
    imageTshirtBlack,
    imageTshirtWhite,
    imageHero,
    accessoriesCategory,
    tshirtsCategory,
    hatsCategory,
  ] = await Promise.all([
    payload.create({
      collection: 'media',
      data: { ...imageHatData, tenant: defaultTenantId },
      file: imageHatBuffer,
    }),
    payload.create({
      collection: 'media',
      data: { ...imageTshirtBlackData, tenant: defaultTenantId },
      file: imageTshirtBlackBuffer,
    }),
    payload.create({
      collection: 'media',
      data: { ...imageTshirtWhiteData, tenant: defaultTenantId },
      file: imageTshirtWhiteBuffer,
    }),
    payload.create({
      collection: 'media',
      data: { ...imageHero1Data, tenant: defaultTenantId },
      file: heroBuffer,
    }),
    ...categories.map((category) =>
      payload.create({
        collection: 'categories',
        data: {
          title: category,
          slug: category,
          tenant: defaultTenantId,
        },
      }),
    ),
  ])

  payload.logger.info(`— Seeding variant types and options...`)

  const sizeVariantType = await payload.create({
    collection: 'variantTypes',
    data: {
      name: 'size',
      label: 'Size',
    },
  })

  const sizeVariantOptionsResults: VariantOption[] = []

  for (const option of sizeVariantOptions) {
    const result = await payload.create({
      collection: 'variantOptions',
      data: {
        ...option,
        variantType: sizeVariantType.id,
      },
    })
    sizeVariantOptionsResults.push(result)
  }

  const [small, medium, large, xlarge] = sizeVariantOptionsResults

  const colorVariantType = await payload.create({
    collection: 'variantTypes',
    data: {
      name: 'color',
      label: 'Color',
    },
  })

  const [black, white] = await Promise.all(
    colorVariantOptions.map((option) => {
      return payload.create({
        collection: 'variantOptions',
        data: {
          ...option,
          variantType: colorVariantType.id,
        },
      })
    }),
  )

  payload.logger.info(`— Seeding products...`)

  const productHat = await payload.create({
    collection: 'products',
    depth: 0,
    data: {
      ...productHatData({
        galleryImage: imageHat,
        metaImage: imageHat,
        variantTypes: [colorVariantType],
        categories: [hatsCategory],
        relatedProducts: [],
      }),
      tenant: defaultTenantId,
    },
  })

  const productTshirt = await payload.create({
    collection: 'products',
    depth: 0,
    data: {
      ...productTshirtData({
      galleryImages: [
        { image: imageTshirtBlack, variantOption: black },
        { image: imageTshirtWhite, variantOption: white },
      ],
      metaImage: imageTshirtBlack,
      contentImage: imageHero,
      variantTypes: [colorVariantType, sizeVariantType],
      categories: [tshirtsCategory],
      relatedProducts: [productHat],
    }),
      tenant: defaultTenantId,
    },
  })

  let hoodieID: number | string = productTshirt.id

  if (payload.db.defaultIDType === 'text') {
    hoodieID = `"${hoodieID}"`
  }

  const [
    smallTshirtHoodieVariant,
    mediumTshirtHoodieVariant,
    largeTshirtHoodieVariant,
    xlargeTshirtHoodieVariant,
  ] = await Promise.all(
    [small, medium, large, xlarge].map((variantOption) =>
      payload.create({
        collection: 'variants',
        depth: 0,
        data: productTshirtVariant({
          product: productTshirt,
          variantOptions: [variantOption, white],
        }),
      }),
    ),
  )

  await Promise.all(
    [small, medium, large, xlarge].map((variantOption) =>
      payload.create({
        collection: 'variants',
        depth: 0,
        data: productTshirtVariant({
          product: productTshirt,
          variantOptions: [variantOption, black],
          ...(variantOption.value === 'medium' ? { inventory: 0 } : {}),
        }),
      }),
    ),
  )

  payload.logger.info(`— Seeding contact form...`)

  const contactForm = await payload.create({
    collection: 'forms',
    depth: 0,
    data: contactFormData(),
  })

  payload.logger.info(`— Seeding pages...`)

  const [, contactPage] = await Promise.all([
    payload.create({
      collection: 'pages',
      depth: 0,
      data: {
        ...homePageData({
          contentImage: imageHero,
          metaImage: imageHat,
        }),
        tenant: defaultTenantId,
      },
    }),
    payload.create({
      collection: 'pages',
      depth: 0,
      data: {
        ...contactPageData({
          contactForm: contactForm,
        }),
        tenant: defaultTenantId,
      },
    }),
  ])

  payload.logger.info(`— Seeding posts...`)

  const postsData = angelOsPostsData(imageHero)
  for (const postData of postsData) {
    await payload.create({
      collection: 'posts',
      depth: 0,
      data: {
        title: postData.title,
        slug: postData.slug,
        _status: 'published',
        publishedOn: new Date(),
        hero: postData.hero ?? { type: 'none' },
        layout: postData.layout,
        meta: {
          image: imageHero?.id,
          description: postData.excerpt,
          title: postData.title,
        },
        tenant: defaultTenantId,
      } as any,
    })
  }

  payload.logger.info(`— Seeding addresses...`)

  // Admin address (for account page)
  await payload.create({
    collection: 'addresses',
    depth: 0,
    data: {
      customer: adminUserId,
      ...adminAddressData,
    },
  })

  const customerUSAddress = await payload.create({
    collection: 'addresses',
    depth: 0,
    data: {
      customer: customerUserId,
      ...(baseAddressUSData as Address),
    },
  })

  const customerUKAddress = await payload.create({
    collection: 'addresses',
    depth: 0,
    data: {
      customer: customerUserId,
      ...(baseAddressUKData as Address),
    },
  })

  payload.logger.info(`— Seeding transactions...`)

  const pendingTransaction = await payload.create({
    collection: 'transactions',
    data: {
      currency: 'USD',
      customer: customerUserId,
      paymentMethod: 'stripe',
      stripe: {
        customerID: 'cus_123',
        paymentIntentID: 'pi_123',
      },
      status: 'pending',
      billingAddress: baseAddressUSData,
    },
  })

  const succeededTransaction = await payload.create({
    collection: 'transactions',
    data: {
      currency: 'USD',
      customer: customerUserId,
      paymentMethod: 'stripe',
      stripe: {
        customerID: 'cus_123',
        paymentIntentID: 'pi_123',
      },
      status: 'succeeded',
      billingAddress: baseAddressUSData,
    },
  })

  let succeededTransactionID: number | string = succeededTransaction.id

  if (payload.db.defaultIDType === 'text') {
    succeededTransactionID = `"${succeededTransactionID}"`
  }

  payload.logger.info(`— Seeding carts...`)

  // This cart is open as it's created now
  const openCart = await payload.create({
    collection: 'carts',
    data: {
      customer: customerUserId,
      currency: 'USD',
      items: [
        {
          product: productTshirt.id,
          variant: mediumTshirtHoodieVariant.id,
          quantity: 1,
        },
      ],
    },
  })

  const oldTimestamp = new Date('2023-01-01T00:00:00Z').toISOString()

  // Cart is abandoned because it was created long in the past
  const abandonedCart = await payload.create({
    collection: 'carts',
    data: {
      currency: 'USD',
      createdAt: oldTimestamp,
      items: [
        {
          product: productHat.id,
          quantity: 1,
        },
      ],
    },
  })

  // Cart is purchased because it has a purchasedAt date
  const completedCart = await payload.create({
    collection: 'carts',
    data: {
      customer: customerUserId,
      currency: 'USD',
      purchasedAt: new Date().toISOString(),
      subtotal: 7499,
      items: [
        {
          product: productTshirt.id,
          variant: smallTshirtHoodieVariant.id,
          quantity: 1,
        },
        {
          product: productTshirt.id,
          variant: mediumTshirtHoodieVariant.id,
          quantity: 1,
        },
      ],
    },
  })

  let completedCartID: number | string = completedCart.id

  if (payload.db.defaultIDType === 'text') {
    completedCartID = `"${completedCartID}"`
  }

  payload.logger.info(`— Seeding orders...`)

  const orderInCompleted = await payload.create({
    collection: 'orders',
    data: {
      tenant: defaultTenantId,
      amount: 7499,
      currency: 'USD',
      customer: customerUserId,
      shippingAddress: baseAddressUSData,
      items: [
        {
          product: productTshirt.id,
          variant: smallTshirtHoodieVariant.id,
          quantity: 1,
        },
        {
          product: productTshirt.id,
          variant: mediumTshirtHoodieVariant.id,
          quantity: 1,
        },
      ],
      status: 'completed',
      transactions: [succeededTransaction.id],
    },
  })

  const orderInProcessing = await payload.create({
    collection: 'orders',
    data: {
      tenant: defaultTenantId,
      amount: 7499,
      currency: 'USD',
      customer: customerUserId,
      shippingAddress: baseAddressUSData,
      items: [
        {
          product: productTshirt.id,
          variant: smallTshirtHoodieVariant.id,
          quantity: 1,
        },
        {
          product: productTshirt.id,
          variant: mediumTshirtHoodieVariant.id,
          quantity: 1,
        },
      ],
      status: 'processing',
      transactions: [succeededTransaction.id],
    },
  })

  payload.logger.info(`— Seeding header and footer (tenant-scoped)...`)

  const headerNavItems = [
    { link: { type: 'custom' as const, label: 'Home', url: '/' } },
    { link: { type: 'custom' as const, label: 'Shop', url: '/shop' } },
    { link: { type: 'custom' as const, label: 'Posts', url: '/posts' } },
    { link: { type: 'custom' as const, label: 'Account', url: '/account' } },
  ]

  const footerNavItems = [
    { link: { type: 'custom' as const, label: 'Admin', url: '/admin' } },
    { link: { type: 'custom' as const, label: 'Find my order', url: '/find-order' } },
    { link: { type: 'custom' as const, label: 'Source Code', newTab: true, url: 'https://github.com/payloadcms/payload/tree/main/templates/website' } },
    { link: { type: 'custom' as const, label: 'Payload', newTab: true, url: 'https://payloadcms.com/' } },
  ]

  await Promise.all([
    payload.create({
      collection: 'header',
      data: { tenant: defaultTenantId, navItems: headerNavItems },
      depth: 0,
    }),
    payload.create({
      collection: 'footer',
      data: { tenant: defaultTenantId, navItems: footerNavItems },
      depth: 0,
    }),
  ])

  payload.logger.info('Seeded database successfully!')
}

async function fetchFileByURL(url: string): Promise<File> {
  const res = await fetch(url, {
    credentials: 'include',
    method: 'GET',
  })

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
