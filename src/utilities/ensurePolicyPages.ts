import type { Payload } from 'payload'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
  createUnorderedListNode,
} from '@/utilities/lexicalHelpers'

/**
 * ensurePolicyPages — stamp the standard legal/policy pages onto a tenant and link
 * them in the footer. Every endeavor that takes money (donations, memberships/dues,
 * bookings) or collects contact/SMS consent needs these; this provisions them from
 * existing content blocks (zero schema risk), idempotent by slug, and appends footer
 * nav links so they're reachable site-wide.
 *
 * The copy is generic, ready-to-use boilerplate parameterised by org name + contact —
 * a sensible default each endeavor can edit. NOT a substitute for counsel on
 * regulated specifics; it covers the common-case community/SaaS surface honestly.
 *
 * @see src/utilities/provisionChurchSite.ts / provisionFitnessSite.ts (callers)
 */

export interface PolicyProfile {
  /** Organization / endeavor name shown throughout the policies. */
  orgName: string
  /** Contact email for privacy/data/refund requests. */
  contactEmail?: string
  /** Governing-law jurisdiction line. Defaults to Florida, USA. */
  governingLaw?: string
  /** Whether the site sells/charges (shows the refund policy). Default true. */
  takesPayments?: boolean
}

interface PolicySpec {
  slug: string
  title: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layout: any[]
  meta: { title: string; description: string }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const content = (nodes: any[]) => ({
  blockType: 'content',
  columns: [{ size: 'full' as const, richText: createLexicalContent(nodes) }],
})

function buildPolicies(p: Required<PolicyProfile>): PolicySpec[] {
  const { orgName, contactEmail, governingLaw } = p
  const contactLine = contactEmail
    ? `If you have questions about these terms, contact us at ${contactEmail}.`
    : 'If you have questions about these terms, please reach out through our Contact page.'

  const specs: PolicySpec[] = [
    {
      slug: 'privacy-policy',
      title: 'Privacy Policy',
      layout: [
        content([
          createHeadingNode('Privacy Policy', 'h1'),
          createParagraphNode(`${orgName} respects your privacy. This policy explains what information we collect, how we use it, and the choices you have.`),
          createHeadingNode('Information We Collect', 'h2'),
          createUnorderedListNode([
            'Contact details you provide (name, email, phone) when you sign up, give, subscribe, or message us.',
            'Payment information processed securely by our payment provider (Stripe) — we do not store card numbers.',
            'Basic usage and device data to keep the site secure and working.',
          ]),
          createHeadingNode('How We Use It', 'h2'),
          createUnorderedListNode([
            'To provide the services you request (memberships, giving, bookings, communication).',
            'To send receipts, confirmations, and messages you have opted into.',
            'To protect the site and comply with the law.',
          ]),
          createParagraphNode('We do not sell your personal information. We share it only with service providers who help us operate (e.g. payment and messaging providers) and only as needed.'),
          createHeadingNode('Your Choices', 'h2'),
          createParagraphNode('You may request access to, correction of, or deletion of your personal information, and you may unsubscribe from non-essential messages at any time. ' + contactLine),
        ]),
      ],
      meta: { title: `Privacy Policy — ${orgName}`, description: `How ${orgName} collects, uses, and protects your information.` },
    },
    {
      slug: 'terms-of-service',
      title: 'Terms of Service',
      layout: [
        content([
          createHeadingNode('Terms of Service', 'h1'),
          createParagraphNode(`By using the ${orgName} website and services, you agree to these terms. Please read them carefully.`),
          createHeadingNode('Use of the Service', 'h2'),
          createUnorderedListNode([
            'Use the service lawfully and respectfully.',
            'Provide accurate information when you sign up, give, or subscribe.',
            'You are responsible for activity under your account.',
          ]),
          createHeadingNode('Payments & Subscriptions', 'h2'),
          createParagraphNode('Memberships, dues, and recurring gifts bill on the interval shown at sign-up via our payment provider until cancelled. You can cancel a recurring plan at any time; cancellation stops future charges and does not retroactively refund past periods unless required by law or our Refund Policy.'),
          createHeadingNode('Content & Conduct', 'h2'),
          createParagraphNode('You retain ownership of content you submit, and grant us a limited license to display it as part of operating the service. We may remove content or suspend access for conduct that violates these terms.'),
          createHeadingNode('Disclaimers & Liability', 'h2'),
          createParagraphNode('The service is provided "as is." To the fullest extent permitted by law, our liability is limited to the amount you paid us in the prior twelve months.'),
          createHeadingNode('Governing Law', 'h2'),
          createParagraphNode(`These terms are governed by the laws of ${governingLaw}. ${contactLine}`),
        ]),
      ],
      meta: { title: `Terms of Service — ${orgName}`, description: `The terms governing use of ${orgName}'s website and services.` },
    },
    {
      slug: 'cookie-policy',
      title: 'Cookie Policy',
      layout: [
        content([
          createHeadingNode('Cookie Policy', 'h1'),
          createParagraphNode(`${orgName} uses cookies and similar technologies to keep you signed in, remember your preferences, and understand how the site is used.`),
          createHeadingNode('Types of Cookies', 'h2'),
          createUnorderedListNode([
            'Essential — required for login, security, and core functionality.',
            'Preferences — remember choices like theme and language.',
            'Analytics — help us understand usage so we can improve.',
          ]),
          createParagraphNode('You can control cookies through your browser settings. Disabling essential cookies may break parts of the site. ' + contactLine),
        ]),
      ],
      meta: { title: `Cookie Policy — ${orgName}`, description: `How ${orgName} uses cookies and how to control them.` },
    },
  ]

  if (p.takesPayments) {
    specs.push({
      slug: 'refund-policy',
      title: 'Refund Policy',
      layout: [
        content([
          createHeadingNode('Refund Policy', 'h1'),
          createParagraphNode(`This policy describes how ${orgName} handles refunds for payments, memberships, and bookings.`),
          createHeadingNode('Memberships & Recurring Dues', 'h2'),
          createParagraphNode('You may cancel a recurring membership at any time to stop future charges. We do not generally refund the current billing period once it has begun, except where required by law.'),
          createHeadingNode('Bookings & One-Time Purchases', 'h2'),
          createParagraphNode('Refund eligibility for bookings and one-time purchases depends on the service and any notice given. Contact us as early as possible and we will work with you in good faith.'),
          createHeadingNode('Donations', 'h2'),
          createParagraphNode('Donations are voluntary gifts and are generally non-refundable. If a gift was made in error, contact us promptly and we will review the request.'),
          createParagraphNode(contactLine),
        ]),
      ],
      meta: { title: `Refund Policy — ${orgName}`, description: `How ${orgName} handles refunds and cancellations.` },
    })
  }

  return specs
}

export interface PolicyPagesResult {
  created: string[]
  updated: string[]
  skipped: string[]
  footerLinked: string[]
}

export async function ensurePolicyPages(
  payload: Payload,
  tenantId: number | string,
  profile: PolicyProfile,
  opts: { overwrite?: boolean } = {},
): Promise<PolicyPagesResult> {
  const p: Required<PolicyProfile> = {
    orgName: profile.orgName,
    contactEmail: profile.contactEmail || '',
    governingLaw: profile.governingLaw || 'the State of Florida, USA',
    takesPayments: profile.takesPayments !== false,
  }

  const specs = buildPolicies(p)
  const created: string[] = []
  const updated: string[] = []
  const skipped: string[] = []

  for (const spec of specs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageData: any = {
      slug: spec.slug,
      title: spec.title,
      _status: 'published',
      tenant: tenantId,
      showInNav: false, // policy pages live in the footer, not the main nav
      hero: { type: 'lowImpact', richText: createLexicalContent([createHeadingNode(spec.title, 'h1')]) },
      layout: spec.layout,
      meta: spec.meta,
    }

    const existing = await payload.find({
      collection: 'pages',
      where: { and: [{ slug: { equals: spec.slug } }, { tenant: { equals: tenantId } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const existingDoc = existing.docs?.[0] as { id: number | string } | undefined

    if (existingDoc) {
      if (!opts.overwrite) {
        skipped.push(spec.slug)
        continue
      }
      await payload.update({ collection: 'pages', id: existingDoc.id, depth: 0, overrideAccess: true, data: pageData })
      updated.push(spec.slug)
      continue
    }
    await payload.create({ collection: 'pages', depth: 0, overrideAccess: true, data: pageData })
    created.push(spec.slug)
  }

  const footerLinked = await linkPoliciesInFooter(payload, tenantId, specs)
  return { created, updated, skipped, footerLinked }
}

/**
 * Append footer nav links for the policy pages (idempotent by URL, respecting the
 * footer's 6-row cap). Creates the tenant's footer doc if missing.
 */
async function linkPoliciesInFooter(
  payload: Payload,
  tenantId: number | string,
  specs: PolicySpec[],
): Promise<string[]> {
  const desired = specs.map((s) => ({ url: `/${s.slug}`, label: s.title }))

  const found = await payload.find({
    collection: 'footer',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const footerDoc = found.docs?.[0] as any | undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingItems: any[] = Array.isArray(footerDoc?.navItems) ? footerDoc.navItems : []
  const existingUrls = new Set(
    existingItems.map((it) => (it?.link?.url as string | undefined)?.replace(/\/$/, '')).filter(Boolean),
  )

  const linked: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newItems: any[] = [...existingItems]
  for (const d of desired) {
    if (existingUrls.has(d.url)) continue
    if (newItems.length >= 6) break // footer navItems maxRows
    newItems.push({ link: { type: 'custom', url: d.url, label: d.label, newTab: false } })
    linked.push(d.url)
  }

  if (linked.length === 0) return []

  if (footerDoc) {
    await payload.update({
      collection: 'footer',
      id: footerDoc.id,
      depth: 0,
      overrideAccess: true,
      data: { navItems: newItems } as never,
    })
  } else {
    await payload.create({
      collection: 'footer',
      depth: 0,
      overrideAccess: true,
      data: { label: 'Main Footer', tenant: tenantId, navItems: newItems } as never,
    })
  }
  return linked
}
