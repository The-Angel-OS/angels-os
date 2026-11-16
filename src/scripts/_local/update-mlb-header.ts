import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })
const tenantSlug = 'mlb'

const tenants = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: tenantSlug } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenant = tenants.docs?.[0] as { id: number } | undefined
if (!tenant) {
  console.error('No mlb tenant found.')
  process.exit(1)
}
const tenantId = tenant.id

const headerDocs = await payload.find({
  collection: 'header',
  where: { tenant: { equals: tenantId } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})

const navLink = (label: string, url: string) => ({
  link: {
    type: 'custom' as const,
    label,
    url,
    newTab: false,
  },
})

const mlbNavItems = [
  navLink('Home', '/'),
  navLink('Old World Atlas', '/atlas'),
  navLink('Episodes', '/episodes'),
  navLink('Posts', '/posts'),
  navLink('Shop', '/shop'),
  navLink('Community', '/dashboard/spaces'),
]

if (headerDocs.docs[0]) {
  await payload.update({
    collection: 'header',
    id: headerDocs.docs[0].id,
    data: { navItems: mlbNavItems } as any,
    overrideAccess: true,
  })
  console.log(`[MLB Header] Successfully updated header #${headerDocs.docs[0].id} with Episodes & Shop!`)
} else {
  const created = await payload.create({
    collection: 'header',
    data: { tenant: tenantId, navItems: mlbNavItems } as any,
    overrideAccess: true,
  })
  console.log(`[MLB Header] Successfully created header #${created.id} with Episodes & Shop!`)
}

process.exit(0)
