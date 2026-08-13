/**
 * Conform Kessela's header + footer to www.kessela.com.
 *
 * Header: the reference uses the full page names, and two of ours pointed at
 * different destinations than the original (/posts and the product page rather
 * than the mirrored /studies-blog and /buy-kessela-now pages). Both resolve, so
 * this is a fidelity fix, not a broken-link fix.
 *
 * Footer: the reference carries 12 links; ours had 4. navItems is capped at 6,
 * so the full set goes into navGroups (columns), which is what that field is for.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const TENANT = 30

const payload = await getPayload({ config })

const link = (label: string, url: string) => ({
  link: { type: 'custom' as const, label, url, newTab: false },
})

const header = await payload.find({
  collection: 'header', where: { tenant: { equals: TENANT } }, limit: 1, depth: 0, overrideAccess: true,
})
const footer = await payload.find({
  collection: 'footer', where: { tenant: { equals: TENANT } }, limit: 1, depth: 0, overrideAccess: true,
})

if (header.docs[0]) {
  await payload.update({
    collection: 'header',
    id: (header.docs[0] as { id: number }).id,
    data: {
      navItems: [
        link('How to Use the Belt', '/how-to-use-belt'),
        link('Results & Testimonials', '/results-testimonials'),
        link('Studies & Blog', '/studies-blog'),
        link('Buy Kessela Now!', '/buy-kessela-now'),
      ],
    } as never,
    overrideAccess: true,
  })
  console.log('header: 4 items (reference nav)')
}

if (footer.docs[0]) {
  await payload.update({
    collection: 'footer',
    id: (footer.docs[0] as { id: number }).id,
    data: {
      navItems: [],
      navGroups: [
        {
          heading: 'Explore',
          items: [
            link('Home', '/'),
            link('Buy Kessela Now!', '/buy-kessela-now'),
            link('Results & Testimonials', '/results-testimonials'),
            link('How to Use the Belt', '/how-to-use-belt'),
            link('Studies & Blog', '/studies-blog'),
          ],
        },
        {
          heading: 'Support',
          items: [
            link('Register Your Kessela', '/register-kessela'),
            link('Contact Us', '/contact'),
            link('Shipping & Delivery', '/shipping-delivery'),
            link('Refund & Returns', '/refund-returns'),
            link('Warranty & Claims', '/warranty'),
          ],
        },
        {
          heading: 'Legal',
          items: [link('Terms of Service', '/terms-of-service'), link('Privacy Policy', '/privacy-policy')],
        },
      ],
    } as never,
    overrideAccess: true,
  })
  console.log('footer: 12 links across 3 columns (reference footer)')
}
