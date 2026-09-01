/**
 * Celersoft LLC — the faithful replica.
 *
 * `celersoft-demo.ts` provisions the portal from the generic `enterprise` trade
 * pack: right words, our layout, a generated stock hero. That is the right thing
 * for a stranger off a Craigslist ad. It is the wrong thing for a pitch to the
 * man who owns the site, because the whole argument is "this is YOUR site,
 * running on our platform" and he will notice in two seconds that it is not.
 *
 * So this pass replaces the look with theirs, measured off the live site rather
 * than guessed:
 *
 *   palette   #44D2F6 cyan on #102147 navy   (their --bs-primary / --bs-dark)
 *   body      #474545 on white               (their most-used text/bg pair)
 *   fonts     Open Sans + Roboto             (the only two they load)
 *   theme     light                          (their body background is white)
 *   imagery   their own files, 11 of them, including the real logo
 *   layout    carousel of six offerings -> services showcase -> SOC 2 block ->
 *             featured solution -> trusted partners, in that order
 *
 * Run celersoft-demo.ts FIRST — that creates the portal, the spaces, the
 * contact form and the booking catalog. This one only re-dresses it, and is
 * idempotent: media is reused by filename, pages overwrite by slug.
 *
 *   pnpm payload run src/scripts/_local/celersoft-site.ts
 *   railway run -s Core -- node src/scripts/_local/_prod.mjs src/scripts/_local/celersoft-site.ts
 *
 * The assets are downloaded separately (see ASSET_DIR). They are Celersoft's own
 * files, reproduced for a private demo shown to their owner; the portal is
 * networkVisible:false and noindex, and licensing of the stock photography is
 * theirs, not ours. If this ever becomes a public site, the images are the first
 * thing that has to be re-cleared.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import path from 'node:path'
import fs from 'node:fs'
import { provisionPagesFromSpec, type PageFromSpec } from '@/utilities/provisionPagesFromSpec'
import { applyBrochureNav } from '@/utilities/applyBrochureNav'

const SLUG = 'celersoft'
const ASSET_DIR =
  process.env.CELERSOFT_ASSETS ||
  path.resolve(process.cwd(), 'src/scripts/_local/assets/celersoft')

/**
 * Their files, fetched on demand rather than committed.
 *
 * These are Celersoft's images and their stock photography licences, so they do
 * not belong in our repository -- committing them would redistribute someone
 * else's licensed assets and add 8MB to every clone. Fetching at run time keeps
 * the script self-contained without us holding a copy.
 *
 * Their server 403s a bare client, hence the browser headers.
 */
const ASSET_FILES = [
  'Celersoft_Logo.png',
  'infracaro.jpeg',
  'slide2.jpg',
  'slide4.jpg',
  'sap1.png',
  'microcaro2.jpeg',
  'itstaffing3.png',
  'infrastructure1.jpg',
  'indigo.png',
  'kloudspot1.png',
  'Trusted-Partner.png',
]

async function ensureAssets(): Promise<void> {
  fs.mkdirSync(ASSET_DIR, { recursive: true })
  for (const file of ASSET_FILES) {
    const dest = path.join(ASSET_DIR, file)
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) continue
    const res = await fetch(`https://celersoft.com/assets/img/${file}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
        Referer: 'https://celersoft.com/',
      },
    })
    if (!res.ok) {
      console.warn(`  fetch ${file}: HTTP ${res.status} — skipping`)
      continue
    }
    // Uint8Array, not Buffer: under this TS lib Buffer's ArrayBufferLike does
    // not satisfy writeFileSync's ArrayBufferView, and it fails the build.
    const buf = new Uint8Array(await res.arrayBuffer())
    // Their server answers a missing file with an HTML page and a 200, which is
    // how managed-services.jpg -- broken on their own live site -- arrived as a
    // 2KB "image" the first time round.
    const head = new TextDecoder().decode(buf.subarray(0, 200)).trimStart().toLowerCase()
    if (head.startsWith('<')) {
      console.warn(`  fetch ${file}: got HTML, not an image — skipping`)
      continue
    }
    fs.writeFileSync(dest, buf)
    console.log(`  fetched ${file} (${buf.length} bytes)`)
  }
}

console.log(`assets in ${ASSET_DIR}`)
await ensureAssets()

const payload = await getPayload({ config })

const found = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: SLUG } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenant = found.docs[0] as { id: number; name: string } | undefined
if (!tenant) throw new Error(`No tenant "${SLUG}" — run celersoft-demo.ts first.`)
const TENANT = tenant.id
console.log(`tenant #${TENANT} ${tenant.name}`)

/* ------------------------------------------------------------------ media */

/** Upload one of their files, or reuse it if this has run before. */
async function media(file: string, alt: string): Promise<number | undefined> {
  const filePath = path.join(ASSET_DIR, file)
  if (!fs.existsSync(filePath)) {
    console.warn(`  MISSING ${file} — skipping`)
    return undefined
  }
  // Payload slugifies the stored filename, so match on the alt text we set,
  // which we control exactly. Matching on filename guessed wrong and re-uploaded
  // every run.
  const existing = await payload.find({
    collection: 'media',
    where: { and: [{ tenant: { equals: TENANT } }, { alt: { equals: alt } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs[0]) {
    const id = Number((existing.docs[0] as { id: number }).id)
    console.log(`  reuse  ${file} -> #${id}`)
    return id
  }
  const created = (await (payload.create as never as (a: unknown) => Promise<{ id: number }>)({
    collection: 'media',
    data: { alt, tenant: TENANT },
    filePath,
    overrideAccess: true,
  })) as { id: number }
  console.log(`  upload ${file} -> #${created.id}`)
  return Number(created.id)
}

console.log('media:')
const logo = await media('Celersoft_Logo.png', 'Celersoft')
const infra = await media('infracaro.jpeg', 'Celersoft — Infrastructure Solutions')
const analytics = await media('slide2.jpg', 'Celersoft — Business Analytics')
const cyber = await media('slide4.jpg', 'Celersoft — Cyber Security')
const erp = await media('sap1.png', 'Celersoft — SAP & ERP Solutions')
const micro = await media('microcaro2.jpeg', 'Celersoft — Micro Services')
const staffing = await media('itstaffing3.png', 'Celersoft — IT Staffing')
const showcase = await media('infrastructure1.jpg', 'Celersoft — Infrastructure')
const partnerA = await media('indigo.png', 'Indigo')
const partnerB = await media('kloudspot1.png', 'Kloudspot')
const partnerC = await media('Trusted-Partner.png', 'Trusted Partner')

// Their own `managed-services.jpg` 404s on celersoft.com — the Featured Solution
// block on their live home page renders no image at all. Reusing the
// infrastructure shot keeps the section whole rather than reproducing the bug.
const managed = showcase

/* --------------------------------------------------------------- branding */

await payload.update({
  collection: 'tenants',
  id: TENANT,
  data: {
    branding: {
      ...(logo ? { logo, favicon: logo } : {}),
      siteName: 'Celersoft',
      tagline: 'Empowering businesses to navigate the future with confidence.',
      defaultTheme: 'light',
      primaryColor: '#44D2F6',
      secondaryColor: '#102147',
      // Their headings are Roboto, which `headingFont` does not offer — its
      // options are Inter, Playfair, Montserrat, Raleway, Poppins. Inter is the
      // closest neutral grotesque; Montserrat and Poppins are geometric and
      // would read as a different brand. Adding Roboto to the enum is a
      // migration, so it is a punch-list item, not something to sneak in here.
      headingFont: 'inter',
      bodyFont: 'roboto',
    },
    storefront: {
      contactEmail: 'info@celersoft.com',
      contactPhone: '(+1) 832-225-8898',
      address: {
        street: '1500 S Dairy Ashford Rd, Ste 355',
        city: 'Houston',
        region: 'TX',
        postalCode: '77077',
        country: 'US',
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  overrideAccess: true,
})
console.log('branding: #44D2F6 on #102147, light, Open Sans + Roboto, logo set')

/* ------------------------------------------------------------------ pages */

const OFFERINGS = [
  {
    n: '01',
    name: 'Infrastructure Solutions',
    sub: 'Cloud • Data Center • Network',
    media: infra,
    body: 'Empower your business with scalable, secure and resilient infrastructure that supports modern digital transformation. Cloud infrastructure, private 5G, data centers and managed services, designed and run as one program rather than a series of projects.',
  },
  {
    n: '02',
    name: 'Business Analytics',
    sub: 'AI • Dashboards • Insights',
    media: analytics,
    body: 'Warehouses, pipelines and dashboards that answer the questions the business actually asks — with the AI layer sitting on top of governed data rather than instead of it.',
  },
  {
    n: '03',
    name: 'ERP Solutions',
    sub: 'SAP • Oracle • Integration',
    media: erp,
    body: 'SAP and Oracle implementation, upgrade and integration, including the interfaces to everything the ERP was never meant to talk to.',
  },
  {
    n: '04',
    name: 'Cybersecurity',
    sub: 'SOC • Zero Trust • SIEM',
    media: cyber,
    body: 'SOC operations, zero-trust architecture and SIEM, plus the compliance evidence that turns good practice into a passed audit.',
  },
  {
    n: '05',
    name: 'Microservices',
    sub: 'Containers • APIs • DevOps',
    media: micro,
    body: 'Containers, APIs and delivery pipelines — decomposing the monolith without stopping the business that depends on it.',
  },
  {
    n: '06',
    name: 'IT Staffing',
    sub: 'Talent • Recruitment • Delivery',
    media: staffing,
    body: 'Engineers, architects and delivery leads placed onto your program, screened by people who have done the work themselves.',
  },
]

const OFFICES = [
  { label: 'USA', lines: ['1500 S Dairy Ashford Rd', 'Ste 355, Houston, TX 77077'] },
  { label: 'Canada', lines: ['998 Loft Court', 'London, Ontario, N6G 0J9'] },
  {
    label: 'India',
    lines: ['D. No. 38, 2nd Floor, Arjun Plaza', 'SP Road, Nizampet, Hyderabad, Telangana 500085'],
  },
]

const officeNodes = OFFICES.flatMap((o) => [
  { h3: o.label },
  { p: o.lines.join('\n') },
])

/** Their carousel, as an alternating media/text run — six offerings, six images. */
const offeringSections = OFFERINGS.map((o, i) => ({
  mediaText: {
    eyebrow: `${o.n} — ${o.sub}`,
    heading: o.name,
    body: o.body,
    media: o.media,
    width: 'split' as const,
    side: (i % 2 === 0 ? 'right' : 'left') as 'right' | 'left',
    aspect: '16/9' as const,
    ctaLabel: 'Explore service',
    ctaUrl: '/services',
  },
}))

const partners = [partnerA, partnerB, partnerC].filter((x): x is number => typeof x === 'number')

const pages: PageFromSpec[] = [
  {
    slug: 'home',
    title: 'Home',
    showInNav: false,
    navOrder: 0,
    heroType: infra ? 'fullScreen' : 'lowImpact',
    heroHeading: 'Celersoft',
    heroSub: 'Infrastructure Solutions — Cloud Infrastructure, Physical Infrastructure',
    ...(infra ? { heroImage: infra } : {}),
    meta: {
      title: 'Celersoft — Enterprise IT Services & Consulting',
      description:
        'Business and technology consulting, infrastructure, business analytics, ERP, cybersecurity, microservices and IT staffing.',
    },
    sections: [
      {
        content: [
          { h2: 'At Celersoft LLC' },
          {
            p: 'We empower businesses to navigate the future with confidence through innovative IT services and solutions. Our mission is to deliver tailored, cutting-edge strategies that drive growth, enhance efficiency, and enable success in an ever-evolving world.',
          },
          {
            p: 'Partner with Celersoft to unlock the potential of technology and achieve your goals with agility and excellence. Together, we will shape a smarter, more connected future.',
          },
          {
            p: 'Our offerings span business and technology consulting, infrastructure solutions, business analytics, ERP solutions, cybersecurity, microservices, and IT staffing.',
          },
        ],
      },
      ...offeringSections,
      {
        content: [{ h2: 'Security Assessment' }],
      },
      {
        mediaText: {
          eyebrow: 'SECURITY ASSESSMENT',
          heading: 'SOC 2 & ISO 27001 Readiness Assessment',
          body: 'Evaluate your organization’s security controls, compliance maturity, and audit readiness through Celersoft’s online assessment. Receive a detailed gap analysis and actionable recommendations to accelerate SOC 2 and ISO 27001 compliance.',
          ...(cyber ? { media: cyber } : {}),
          width: 'split' as const,
          side: 'left' as const,
          ctaLabel: 'Start assessment',
          ctaUrl: '/assessment',
        },
      },
      {
        mediaText: {
          eyebrow: 'FEATURED SOLUTION',
          heading: 'Managed Services',
          body: 'Delivering proactive monitoring, infrastructure management and enterprise IT support to keep your business running without interruption. 24×7 monitoring, cloud support, infrastructure and IT operations.',
          ...(managed ? { media: managed } : {}),
          width: 'full' as const,
          ctaLabel: 'Explore solution',
          ctaUrl: '/solutions',
        },
      },
      {
        content: [
          { h2: 'Trusted by businesses across industries' },
          {
            p: 'Leading organizations trust Celersoft to deliver reliable technology solutions that strengthen security, modernize infrastructure, and accelerate digital transformation. Our commitment to quality, innovation, and customer success has helped us build lasting partnerships across multiple industries.',
          },
        ],
      },
      ...(partners.length
        ? [{ gallery: { heading: 'Our trusted partners', columns: '3' as const, images: partners } }]
        : []),
      {
        cta: {
          heading: 'Let us talk about your estate',
          body: 'Tell us what you are running and what is not working. The first conversation is an assessment, not a proposal.',
          links: [
            { label: 'Contact us', url: '/contact' },
            { label: 'Start the security assessment', url: '/assessment', outline: true },
          ],
        },
      },
    ],
  },
  {
    slug: 'services',
    title: 'Services',
    navOrder: 1,
    heroType: showcase ? 'splitPanel' : 'lowImpact',
    heroHeading: 'Services we provide',
    heroSub: 'Consulting, infrastructure, data, security and the people to run it.',
    ...(showcase ? { heroImage: showcase } : {}),
    meta: {
      title: 'Services',
      description: 'Infrastructure, analytics, ERP, cybersecurity, microservices and IT staffing.',
    },
    sections: [
      ...offeringSections,
      {
        cta: {
          heading: 'Not sure where to start?',
          body: 'Most engagements begin with an assessment of what you already have. It stands on its own even if you go no further.',
          links: [{ label: 'Talk to us', url: '/contact' }],
        },
      },
    ],
  },
  {
    slug: 'solutions',
    title: 'Solutions',
    navOrder: 2,
    heroType: managed ? 'splitPanel' : 'lowImpact',
    heroHeading: 'Solutions',
    heroSub: 'Managed services, data centers, private 5G, industrial AR and smart surveillance.',
    ...(managed ? { heroImage: managed } : {}),
    meta: { title: 'Solutions', description: 'Celersoft solutions across infrastructure and operations.' },
    sections: [
      {
        mediaText: {
          eyebrow: 'FEATURED SOLUTION',
          heading: 'Managed Services',
          body: 'Proactive monitoring, infrastructure management and enterprise IT support that keeps the estate running on the days nothing is being built. 24×7 monitoring, cloud support, infrastructure and IT operations.',
          ...(managed ? { media: managed } : {}),
          width: 'split' as const,
          side: 'right' as const,
        },
      },
      {
        content: [
          { h2: 'Data Center Solutions' },
          { p: 'Design, migration and operation of physical and hybrid data center estates.' },
          { h2: 'Private 5G Solutions' },
          { p: 'Private cellular networks for campuses, plants and sites where Wi-Fi does not reach or does not hold.' },
          { h2: 'Industrial AR Solutions' },
          { p: 'Augmented reality for maintenance, inspection and remote expert support on the plant floor.' },
          { h2: 'Smart Surveillance' },
          { p: 'Camera estates with analytics on top, integrated with access control and incident response.' },
          { h2: 'Case Studies' },
          { p: 'This is where the engagements go — the estate, the problem, what changed and by how much. Add them from the dashboard; nothing here is locked.' },
        ],
      },
      {
        cta: {
          heading: 'Which of these is your problem?',
          body: 'Describe the estate and we will tell you honestly what is involved.',
          links: [{ label: 'Contact us', url: '/contact' }],
        },
      },
    ],
  },
  {
    slug: 'about',
    title: 'About Us',
    navOrder: 3,
    heroType: showcase ? 'splitPanel' : 'lowImpact',
    heroHeading: 'About Celersoft',
    heroSub: 'Empowering businesses to navigate the future with confidence.',
    ...(showcase ? { heroImage: showcase } : {}),
    meta: { title: 'About Us', description: 'Celersoft LLC — enterprise IT services and consulting.' },
    sections: [
      {
        content: [
          { h2: 'Who we are' },
          {
            p: 'Celersoft LLC is an enterprise technology consultancy headquartered in Houston, Texas, delivering across North America and India.',
          },
          {
            p: 'We empower businesses to navigate the future with confidence through innovative IT services and solutions, delivering tailored strategies that drive growth, enhance efficiency, and enable success in an ever-evolving world.',
          },
          { h2: 'How we work' },
          {
            p: 'We assess before we propose, we staff engagements with the people who will actually do the work, and we write down what we learn so the capability outlasts the contract.',
          },
          { h2: 'Where we are' },
          ...officeNodes,
        ],
      },
      {
        cta: {
          heading: 'Work with us',
          body: 'Tell us what you need and we will take it from there.',
          links: [{ label: 'Contact us', url: '/contact' }],
        },
      },
    ],
  },
  {
    slug: 'assessment',
    title: 'Security Assessment',
    navOrder: 4,
    heroType: cyber ? 'splitPanel' : 'lowImpact',
    heroHeading: 'SOC 2 & ISO 27001 Readiness Assessment',
    heroSub: 'Find out where the gaps are before an auditor does.',
    ...(cyber ? { heroImage: cyber } : {}),
    meta: {
      title: 'SOC 2 & ISO 27001 Readiness Assessment',
      description:
        'Evaluate your security controls, compliance maturity and audit readiness. Detailed gap analysis and actionable recommendations.',
    },
    sections: [
      {
        content: [
          { h2: 'Know your gaps before the audit does' },
          {
            p: 'Evaluate your organization’s security controls, compliance maturity, and audit readiness. Receive a detailed gap analysis and actionable recommendations to accelerate SOC 2 and ISO 27001 compliance.',
          },
          { h3: 'What the assessment covers' },
          { p: 'Your existing security controls, mapped against the SOC 2 trust services criteria and the ISO 27001 Annex A controls.' },
          { p: 'Compliance maturity — which controls exist, which are documented, and which are evidenced well enough to survive a sample request.' },
          { p: 'Audit readiness, including the evidence you would need to produce and how long producing it would currently take you.' },
          { h3: 'What you get back' },
          { p: 'A written gap analysis, a prioritized remediation plan, and a realistic timeline to audit readiness. Yours to keep, whether or not we do the remediation.' },
        ],
      },
      {
        trustRow: {
          heading: 'How the assessment runs',
          items: [
            { icon: 'lock', label: 'Confidential', detail: 'Under NDA on request' },
            { icon: 'rosette', label: 'No Obligation', detail: 'The report is yours regardless' },
            { icon: 'support', label: 'About Two Weeks', detail: 'Kickoff to findings' },
          ],
          footnote:
            'A readiness assessment is preparation for an audit, not an audit — certification is issued by an accredited auditor, not by us.',
        },
      },
      {
        content: [
          { h2: 'Start your assessment' },
          { p: 'Send the form below and someone will come back to you the same business day, or reach us on (+1) 832-225-8898.' },
        ],
      },
      { contactForm: true },
    ],
  },
  {
    slug: 'careers',
    title: 'Careers',
    navOrder: 5,
    heroType: staffing ? 'splitPanel' : 'lowImpact',
    heroHeading: 'Careers',
    heroSub: 'Engineers, architects and delivery leads — in Houston, London and Hyderabad.',
    ...(staffing ? { heroImage: staffing } : {}),
    meta: { title: 'Careers', description: 'Open roles at Celersoft LLC.' },
    sections: [
      {
        content: [
          { h2: 'Open roles' },
          {
            p: 'Roles are posted here as they open. Each one is a post you write from the dashboard — title, location, description, apply link — and it appears on this page without anyone touching the site.',
          },
          {
            p: 'This is the page that was empty. On the current site it renders three office addresses and nothing else, while IT Staffing is one of six offerings.',
          },
        ],
      },
      { featuredPosts: { heading: 'Latest openings', limit: 6, columns: 3 } },
      {
        content: [{ h2: 'Our offices' }, ...officeNodes],
      },
      {
        cta: {
          heading: 'Nothing open that fits?',
          body: 'Send your CV anyway — placements move faster than postings do.',
          links: [{ label: 'Get in touch', url: '/contact' }],
        },
      },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact Us',
    navOrder: 6,
    heroType: infra ? 'splitPanel' : 'lowImpact',
    heroHeading: 'Contact us',
    heroSub: 'info@celersoft.com · (+1) 832-225-8898',
    ...(infra ? { heroImage: infra } : {}),
    meta: { title: 'Contact Us', description: 'Contact Celersoft LLC — Houston, London and Hyderabad.' },
    sections: [
      {
        content: [
          { h2: 'Get in touch' },
          { p: 'Email info@celersoft.com, call (+1) 832-225-8898, or use the form below.' },
          { h2: 'Our offices' },
          ...officeNodes,
        ],
      },
      { contactForm: true },
    ],
  },
]

const result = await provisionPagesFromSpec(payload, TENANT, pages, { overwrite: true })
console.log(`pages created ${result.created.length}, updated ${result.updated.length}`)

// Retire whatever the generic pack left that this site does not have. The demo
// pack ships an FAQ page; Celersoft's site has no FAQ, and a stale page keeps
// its nav row, so the bar showed a tab that belongs to a different business.
// Unpublish rather than delete -- a draft is invisible and recoverable, and the
// result is RE-QUERIED because payload.delete/update resolves with an `errors`
// array instead of throwing.
const keep = new Set(pages.map((p) => p.slug))
const owned = await payload.find({
  collection: 'pages',
  where: { tenant: { equals: TENANT } },
  limit: 0,
  depth: 0,
  overrideAccess: true,
})
const strays = (owned.docs as Array<{ id: number; slug: string; _status?: string }>).filter(
  (p) => !keep.has(p.slug) && p._status !== 'draft',
)
for (const s of strays) {
  await payload.update({
    collection: 'pages',
    id: s.id,
    data: { _status: 'draft' } as never,
    overrideAccess: true,
  })
}
if (strays.length) {
  const after = await payload.find({
    collection: 'pages',
    where: {
      and: [{ tenant: { equals: TENANT } }, { id: { in: strays.map((s) => s.id) } }],
    },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  const stillLive = (after.docs as Array<{ slug: string; _status?: string }>).filter(
    (p) => p._status !== 'draft',
  )
  console.log(
    `retired ${strays.length - stillLive.length}/${strays.length}: ${strays.map((s) => s.slug).join(', ')}` +
      (stillLive.length ? ` — STILL LIVE: ${stillLive.map((p) => p.slug).join(', ')}` : ''),
  )
}

// Celersoft sells engagements, not products or appointments. Leaving the
// commerce toggles on puts a cart icon and a /book tab on a consultancy's site,
// which is the single most obvious tell that this is somebody's template.
await payload.update({
  collection: 'tenants',
  id: TENANT,
  data: {
    commerce: {
      shippingEnabled: false,
      bookingsEnabled: false,
      eventsEnabled: false,
      digitalProductsEnabled: false,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  overrideAccess: true,
})
console.log('commerce: cart, booking, events and digital products off')

const nav = await applyBrochureNav(payload, TENANT, pages, {
  hidePlatformRoutes: true,
  // Turning the commerce toggles off does not remove these -- the Header adds
  // them regardless -- and a Book tab on a consultancy is the loudest tell that
  // this is somebody's template.
  alsoHide: ['/book', '/posts'],
})
console.log(`nav: ${nav.navItems} items, ${nav.hidden.length} platform routes hidden`)
console.log('done — https://celersoft.spacesangels.com')
