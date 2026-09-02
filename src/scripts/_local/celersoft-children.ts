/**
 * Celersoft LLC — the menu they actually have.
 *
 * `celersoft-site.ts` gave the replica their brand and seven flat pages. Their
 * real site is two dropdowns deep: Services carries eight offerings, Solutions
 * carries six, and a visitor who knows the site will look for them there.
 *
 *   Home · About Us · Services ▾ · Solutions ▾ · Careers · Contact Us
 *
 * This authors those fourteen children and hangs them off the two parents,
 * using `pages.parent` — the field that makes the page tree the menu. Run
 * celersoft-site.ts FIRST; this only adds to it, and is idempotent (pages
 * overwrite by slug, parents are re-resolved every run).
 *
 *   pnpm payload run src/scripts/_local/celersoft-children.ts
 *
 * ON THE COPY: every word below is Celersoft's own, lifted from the live site
 * and trimmed, never invented. This is a pitch shown to the man who owns the
 * business — inventing capabilities, client names or statistics for a real
 * company would be a lie he would catch, and the one thing that cannot happen
 * in a replica is content he has to correct. Where their page is a wall of
 * text, it is cut down; nothing is added. `/case-studies` deliberately keeps
 * only its framing paragraph: the studies name a real client and a real
 * government contract, and abridging someone else's client references is not
 * ours to do.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { provisionPagesFromSpec, type PageFromSpec } from '@/utilities/provisionPagesFromSpec'
import { applyBrochureNav } from '@/utilities/applyBrochureNav'

const SLUG = 'celersoft'

const payload = await getPayload({ config })

const found = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: SLUG } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenant = found.docs[0] as { id: number; name: string } | undefined
if (!tenant) throw new Error(`No tenant "${SLUG}" — run celersoft-demo.ts then celersoft-site.ts first.`)
const TENANT = tenant.id
console.log(`tenant #${TENANT} ${tenant.name}`)

/* ------------------------------------------------------------------ media */

/** Reuse what celersoft-site.ts already uploaded — matched on the alt it set. */
async function mediaByAlt(alt: string): Promise<number | undefined> {
  const r = await payload.find({
    collection: 'media',
    where: { and: [{ tenant: { equals: TENANT } }, { alt: { equals: alt } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = r.docs[0] as { id: number } | undefined
  return doc ? Number(doc.id) : undefined
}

const infra = await mediaByAlt('Celersoft — Infrastructure Solutions')
const analytics = await mediaByAlt('Celersoft — Business Analytics')
const cyber = await mediaByAlt('Celersoft — Cyber Security')
const erp = await mediaByAlt('Celersoft — SAP & ERP Solutions')
const micro = await mediaByAlt('Celersoft — Micro Services')
const staffing = await mediaByAlt('Celersoft — IT Staffing')
const showcase = await mediaByAlt('Celersoft — Infrastructure')

/* ------------------------------------------------------------------ pages */

/** Their menu label, where it differs from the page title. */
type Child = PageFromSpec & { parentSlug: string; navLabel?: string }

const talkToUs = {
  heading: 'Want to talk this through?',
  body: 'Most engagements start with a conversation about what you already have in place.',
  links: [{ label: 'Contact us', url: '/contact' }],
}

const hero = (media: number | undefined) =>
  media ? ({ heroType: 'splitPanel' as const, heroImage: media }) : ({ heroType: 'lowImpact' as const })

const children: Child[] = [
  // ── Services ────────────────────────────────────────────────────────────
  {
    parentSlug: 'services',
    slug: 'infrastructure',
    title: 'Infrastructure Solutions',
    navOrder: 10,
    ...hero(infra),
    heroHeading: 'Infrastructure Solutions',
    heroSub: 'With Celersoft infrastructure solutions, organizations can:',
    meta: { title: 'Infrastructure Solutions | Celersoft', description: 'Cloud integration, on-premises data centers and resilient IT infrastructure.' },
    sections: [
      {
        content: [
          { p: 'Empower your business with robust, scalable, and secure infrastructure solutions designed to support today’s digital demands. Our Infrastructure Solutions team specializes in building and optimizing IT infrastructure that aligns with your business goals, ensuring high performance, reliability, and seamless scalability. From cloud integration to on-premises data centers, our solutions cater to businesses across industries, equipping them with the necessary tools and support for a resilient IT environment.' },
          { h2: 'Why choose our Infrastructure Solutions?' },
          {
            list: [
              'Over 30+ successful engagements in the last 2 years',
              '100% of all projects are completed on time',
              'Strong alliances with Oracle, SAP, and Salesforce.com',
              'Industry expertise: decades of experience designing and managing complex IT environments across various sectors.',
              'Scalable and secure solutions: infrastructure tailored to grow with your business needs, keeping security and compliance as a top priority.',
              'End-to-end support: from planning to implementation and ongoing management, we provide support at every stage of the infrastructure lifecycle.',
            ],
          },
        ],
      },
      { cta: talkToUs },
    ],
  },
  {
    parentSlug: 'services',
    slug: 'business-analytics',
    title: 'Business Analytics',
    navOrder: 11,
    ...hero(analytics),
    heroHeading: 'Business Analytics',
    heroSub: 'Business analytics solutions for data-driven decisions',
    meta: { title: 'Business Analytics | Celersoft', description: 'AI, ML and analytics that turn raw data into decisions.' },
    sections: [
      {
        content: [
          { p: 'Celersoft can enable businesses to leverage AI and ML by delivering tailored solutions for automation, predictive analytics, and data-driven decision-making. With expertise in areas like natural language processing, computer vision, and generative AI, we assist in developing and integrating models into existing systems. From use-case identification to deployment and optimization, we can provide end-to-end support to drive innovation and operational efficiency.' },
          { p: 'Unlock powerful insights and drive smarter decision-making with our Business Analytics solutions. We specialize in transforming raw data into actionable insights, enabling businesses to make data-driven decisions that enhance efficiency, improve customer experiences, and boost profitability. From data visualization to advanced analytics, our services empower organizations to harness the full potential of their data assets.' },
        ],
      },
      { cta: talkToUs },
    ],
  },
  {
    parentSlug: 'services',
    slug: 'sap-solutions',
    title: 'SAP Solutions',
    navOrder: 12,
    ...hero(erp),
    heroHeading: 'SAP Solutions',
    heroSub: 'An official SAP Gold Partner',
    meta: { title: 'SAP Solutions | Celersoft', description: 'SAP implementation, integration, extension and support.' },
    sections: [
      {
        content: [
          { p: 'Through Fit-Gap Analysis and business process mappings, our team will handhold you to explore how best to adopt SAP System functionalities in automating your business processes. And when it comes to converting design plans into software configurations and coding, our team is second to none in ensuring the realization of a working software in record time. As we are an official SAP Gold Partner, you can trust us to deploy your SAP System within your time and cost budget.' },
          { h2: 'What we cover' },
          {
            list: [
              'ERP support models',
              'SAP integration',
              'SAP extension',
              'Data migration',
              'End user training',
              'Change management',
              'SAP value realization',
              'SAP security audit',
              'SAP process re-engineering',
            ],
          },
        ],
      },
      { cta: talkToUs },
    ],
  },
  {
    parentSlug: 'services',
    slug: 'oracle-solutions',
    title: 'Oracle Solutions',
    navOrder: 13,
    ...hero(erp),
    heroHeading: 'Oracle Solutions',
    heroSub: 'Fit-Gap analysis, configuration and support',
    meta: { title: 'Oracle Solutions | Celersoft', description: 'Oracle implementation, training and change management.' },
    sections: [
      {
        content: [
          { p: 'Through Fit-Gap Analysis and business process mappings, our team will handhold you to explore how best to adopt system functionalities in automating your business processes. When it comes to converting design plans into software configurations and coding, our team is second to none in ensuring the realization of working software in record time.' },
          { h2: 'What we cover' },
          { list: ['ERP support models', 'End user training', 'Change management'] },
        ],
      },
      { cta: talkToUs },
    ],
  },
  {
    parentSlug: 'services',
    slug: 'cybersecurity',
    title: 'Cybersecurity',
    navOrder: 14,
    ...hero(cyber),
    heroHeading: 'Cyber Security',
    heroSub: 'Cyber security solutions to protect your digital assets',
    meta: { title: 'Cybersecurity | Celersoft', description: 'Threat detection, IAM, cloud security and compliance support.' },
    sections: [
      {
        content: [
          { p: 'In today’s digital landscape, robust cybersecurity is essential for safeguarding sensitive data and ensuring business continuity. Our Cybersecurity Services offer end-to-end protection for your IT infrastructure, designed to prevent, detect, and respond to evolving cyber threats. With our expert guidance and advanced security solutions, organizations can minimize risk, achieve compliance, and maintain customer trust.' },
          { h2: 'Our cybersecurity service offerings' },
          {
            list: [
              'Security assessment and risk management — comprehensive assessments to identify vulnerabilities, and risk management to prioritize threats and implement mitigation plans.',
              'Threat detection and incident response — real-time monitoring, and rapid response to contain threats before they impact operations.',
              'Network security and firewall management — firewalls, intrusion detection and prevention, monitored and kept current.',
              'Endpoint protection and device security — laptops through mobile devices, managed centrally for consistent organization-wide protection.',
              'Identity and access management — multi-factor authentication, role-based access controls and single sign-on, enforcing least privilege.',
              'Cloud security solutions — securing data and applications in cloud environments, with continuous monitoring against leaks and unauthorized access.',
              'Compliance and regulatory support — GDPR, HIPAA, PCI-DSS and ISO, with the documentation, reporting and audits that keep you aligned.',
            ],
          },
        ],
      },
      { cta: talkToUs },
    ],
  },
  {
    parentSlug: 'services',
    slug: 'microservices',
    title: 'Microservices',
    navOrder: 15,
    ...hero(micro),
    heroHeading: 'Micro Services',
    heroSub: 'Microservices development',
    meta: { title: 'Microservices | Celersoft', description: 'Modular services for agility, efficiency and resilience.' },
    sections: [
      {
        content: [
          { p: 'Microservices architecture is transforming how applications are built, scaled, and managed. By breaking down complex applications into modular, independent services, we help organizations unlock new levels of agility, efficiency, and resilience.' },
          { h2: 'Key benefits' },
          {
            list: [
              'Enhanced connectivity — connect diverse applications and platforms to improve cross-functional processes.',
              'Real-time data exchange — gain insights with synchronized data for timely, data-driven decisions.',
              'Scalable solutions — build flexible integrations that evolve with your business and technology needs.',
            ],
          },
        ],
      },
      { cta: talkToUs },
    ],
  },
  {
    parentSlug: 'services',
    slug: 'it-staffing',
    title: 'IT Staffing',
    navOrder: 17,
    ...hero(staffing),
    heroHeading: 'IT Staffing',
    heroSub: 'Specialized IT recruitment services to power your business',
    meta: { title: 'IT Staffing | Celersoft', description: 'Full-cycle IT recruitment, from requirement analysis to onboarding.' },
    sections: [
      {
        content: [
          { p: 'Our IT recruitment services connect you with top talent, handpicked to drive your business forward. In today’s fast-evolving tech landscape, securing the right professionals is crucial. We combine industry insights, specialized skill matching, and a rigorous selection process to find professionals who fit both your technical needs and company culture.' },
          { h2: 'Why choose our IT recruitment services?' },
          {
            list: [
              'Industry expertise — we specialize in candidates skilled in software development, data analytics, cloud computing, cybersecurity and more.',
              'Tailored hiring solutions — from entry-level tech support to senior management and niche specializations.',
              'Quality-focused selection — technical assessments, skills verification and comprehensive interviews covering technical and soft skills.',
            ],
          },
          { h2: 'End-to-end recruitment process' },
          {
            list: [
              'Job requirement analysis — we work with your team to define the skills, experience and traits you need.',
              'Talent sourcing — job boards, social media and an extensive professional network.',
              'Candidate screening and interviews — technical assessments and in-depth interviews to evaluate expertise.',
            ],
          },
        ],
      },
      { cta: talkToUs },
    ],
  },

  // ── Solutions ───────────────────────────────────────────────────────────
  {
    parentSlug: 'solutions',
    slug: 'managed-services',
    title: 'Managed Services',
    navOrder: 20,
    ...hero(showcase),
    heroHeading: 'Managed Services',
    heroSub: 'Run it with us, not instead of us',
    meta: { title: 'Managed Services | Celersoft', description: 'Proactive monitoring, SLAs, 24/7 support and multi-vendor management.' },
    sections: [
      {
        content: [
          { h2: 'Our managed services' },
          {
            list: [
              'Optimization and reporting',
              'IT automation',
              'Priority support',
              'Full network maintenance',
              'ERP solutions (SAP and Oracle)',
              'IT consulting and strategy',
            ],
          },
          { h2: 'Elements of our managed services practice' },
          {
            list: [
              'Proactive monitoring and maintenance — continuous system oversight to resolve issues before they impact operations.',
              'Service level agreements — clearly defined metrics ensuring accountability against performance expectations.',
              'Scalable infrastructure management — flexible solutions that adapt to evolving business demands and growth.',
              'Comprehensive support services — 24/7 helpdesk, troubleshooting and end-user support.',
              'Expertise in multi-vendor environments — integration and management of diverse technologies across platforms.',
              'Continuous optimization and reporting — performance analysis, cost efficiency assessments and system upgrades.',
            ],
          },
          { h2: 'Industries supported' },
          {
            list: [
              'Banking, mortgage and insurance',
              'Wireless, telecommunications and media',
              'Hi-tech and manufacturing',
              'Logistics and supply chain',
              'Pharmaceuticals',
              'Life sciences and healthcare',
              'Oil and gas',
            ],
          },
        ],
      },
      { cta: talkToUs },
    ],
  },
  {
    parentSlug: 'solutions',
    slug: 'data-centers',
    title: 'Data Center Solutions',
    navOrder: 21,
    ...hero(showcase),
    heroHeading: 'Data Center Solutions',
    heroSub: 'Modern data centers: the foundation of the digital economy',
    meta: { title: 'Data Center Solutions | Celersoft', description: 'Design, optimize and modernize enterprise data center infrastructure.' },
    sections: [
      {
        content: [
          { p: 'Modern data centers are the foundation of today’s digital economy, enabling cloud computing, artificial intelligence, big data analytics, enterprise applications, and mission-critical business operations. As organizations accelerate digital transformation initiatives, the demand for secure, scalable, and resilient data center infrastructure continues to grow.' },
          { p: 'From supporting AI-driven workloads and hybrid cloud environments to ensuring business continuity and operational efficiency, modern data centers have evolved into strategic assets that power innovation and business growth. At Celersoft, we help organizations design, optimize, and modernize enterprise data center infrastructure that supports current business demands while preparing for future technological advancements.' },
          { h2: 'The evolving landscape' },
          {
            list: [
              'A $600B–$700B global market, driven by AI, cloud migration and digital transformation.',
              'Power is the number one constraint — rack densities, liquid cooling and thermal engineering are becoming standard.',
              'Over $1T of global investment expected by 2029, into AI-optimized facilities and distributed edge data centers.',
            ],
          },
        ],
      },
      { cta: talkToUs },
    ],
  },
  {
    parentSlug: 'solutions',
    slug: 'private-5g',
    title: 'Private 5G Solutions',
    navOrder: 22,
    ...hero(infra),
    heroHeading: 'Private 5G Solutions',
    heroSub: 'Transforming industries with private 5G connectivity',
    meta: { title: 'Private 5G Solutions | Celersoft', description: 'Dedicated wireless infrastructure for Industry 4.0, IIoT and edge.' },
    sections: [
      {
        content: [
          { p: 'As organizations accelerate digital transformation, traditional wireless networks are struggling to support the demands of Industry 4.0, Industrial IoT, AI-driven operations, and edge computing. Private 5G connectivity is emerging as a powerful solution that delivers secure, high-performance, and scalable wireless infrastructure for modern enterprises.' },
          { p: 'Unlike conventional WiFi or public cellular networks, Private 5G provides dedicated connectivity with greater control, enhanced security, ultra-low latency, and reliable coverage. This enables organizations to support mission-critical applications, automate operations, and improve decision-making through real-time data access.' },
          { h2: 'Core advantages driving adoption' },
          {
            list: [
              'Superior performance — ultra-low latency, high bandwidth and reliable connectivity for industrial automation, autonomous systems and real-time analytics.',
              'Enhanced security — enterprise-grade encryption, network isolation, secure authentication and centralized management.',
            ],
          },
        ],
      },
      { cta: talkToUs },
    ],
  },
  {
    parentSlug: 'solutions',
    slug: 'industrial-ar',
    title: 'Industrial AR Solutions',
    navOrder: 23,
    ...hero(micro),
    heroHeading: 'Industrial AR Solutions',
    heroSub: 'Cooling under control: industrial AR for data center maintenance',
    meta: { title: 'Industrial AR Solutions | Celersoft', description: 'Real-time asset intelligence and immersive technician support.' },
    sections: [
      {
        content: [
          { p: 'As modern data centers continue to scale in complexity, maintaining optimal cooling performance has become critical to operational efficiency, energy savings, and infrastructure reliability. Traditional maintenance approaches often rely on manual inspections, disconnected monitoring tools, and reactive troubleshooting, resulting in increased operational costs and potential downtime.' },
          { p: 'Celersoft’s Industrial Augmented Reality solutions are transforming data center maintenance by combining real-time asset intelligence, predictive analytics, and immersive technician support into a single digital workflow. By enabling technicians to visualize equipment data directly within the physical environment, Industrial AR helps organizations improve cooling system performance, reduce maintenance complexity, and accelerate issue resolution.' },
          { h2: 'Operational efficiency and cost savings' },
          {
            list: [
              'A 10–20% reduction in cooling energy costs.',
              'Identify airflow inefficiencies, thermal hotspots and cooling performance anomalies before they impact operations.',
            ],
          },
        ],
      },
      { cta: talkToUs },
    ],
  },
  {
    parentSlug: 'solutions',
    slug: 'smart-surveillance',
    title: 'Smart Surveillance Solutions',
    navOrder: 24,
    ...hero(cyber),
    heroHeading: 'Smart Surveillance Solutions',
    heroSub: 'From passive recording to proactive intelligence',
    meta: { title: 'Smart Surveillance Solutions | Celersoft', description: 'AI-powered surveillance for security, compliance and efficiency.' },
    sections: [
      {
        content: [
          { p: 'Traditional surveillance systems are designed to record events after they occur. Today’s organizations require intelligent surveillance solutions that can detect threats, improve safety, and provide actionable insights in real time. By combining artificial intelligence, deep learning, edge computing, and IoT integration, Smart Surveillance transforms video monitoring from passive observation into proactive intelligence.' },
          { p: 'At Celersoft, we help organizations deploy AI-powered surveillance solutions that enhance security, strengthen compliance, improve operational efficiency, and enable faster decision-making across industrial, commercial, and public environments.' },
          { h2: 'What changes' },
          {
            list: [
              'Traditional surveillance records incidents after they occur, needs manual monitoring, and is reactive and storage-focused.',
              'Smart surveillance detects threats in real time, applies AI-powered analytics and predictive intelligence, and sends instant alerts.',
            ],
          },
        ],
      },
      { cta: talkToUs },
    ],
  },
  {
    parentSlug: 'solutions',
    slug: 'case-studies',
    title: 'Case Studies',
    navOrder: 25,
    ...hero(erp),
    heroHeading: 'Case Studies',
    heroSub: 'ERP and SAP work, and what it was worth',
    meta: { title: 'Case Studies | Celersoft', description: 'Real-world ERP and SAP implementations and their business value.' },
    sections: [
      {
        content: [
          { p: 'In this collection of case studies, Celersoft explores real-world implementations of ERP and SAP solutions, showcasing how we have successfully addressed clients’ unique challenges. From streamlining supply chains to improving financial transparency and automating key processes, these examples highlight the transformative power of ERP and SAP in delivering measurable business value in our past projects.' },
        ],
      },
      { cta: { ...talkToUs, heading: 'Want the detail?', body: 'The full write-ups are available on request.' } },
    ],
  },
]

const result = await provisionPagesFromSpec(
  payload,
  TENANT,
  children.map(({ parentSlug: _p, navLabel: _n, ...page }) => page),
  { overwrite: true },
)
console.log(`pages created ${result.created.length}, updated ${result.updated.length}`)

/* ----------------------------------------------------------------- nesting */

/** Every page this tenant has, so a slug can be turned into an id. */
const all = await payload.find({
  collection: 'pages',
  where: { tenant: { equals: TENANT } },
  limit: 200,
  depth: 0,
  overrideAccess: true,
})
const idBySlug = new Map<string, number>()
for (const p of all.docs as Array<{ id: number; slug?: string | null }>) {
  if (p.slug) idBySlug.set(p.slug, Number(p.id))
}

// The existing /assessment page IS their "SOC 2/ISO 27001 Compliance" item —
// same subject, already written and already linked from the home page. Adopting
// it beats authoring a near-duplicate that would then rank against it.
const nesting: Array<{ slug: string; parentSlug: string; navOrder?: number; navLabel?: string }> = [
  ...children.map((c) => ({ slug: c.slug, parentSlug: c.parentSlug, navOrder: c.navOrder, navLabel: c.navLabel })),
  { slug: 'assessment', parentSlug: 'services', navOrder: 16, navLabel: 'SOC 2/ISO 27001 Compliance' },
]

for (const n of nesting) {
  const id = idBySlug.get(n.slug)
  const parentId = idBySlug.get(n.parentSlug)
  if (!id) {
    console.warn(`  MISSING page ${n.slug} — skipping`)
    continue
  }
  if (!parentId) {
    console.warn(`  MISSING parent ${n.parentSlug} for ${n.slug} — skipping`)
    continue
  }
  await payload.update({
    collection: 'pages',
    id,
    data: {
      // An update to a drafts-enabled collection that omits `_status` writes a
      // DRAFT — the live URL 404s and the script still logs success. Pages has
      // drafts. Without this, nesting the menu would have unpublished all
      // fourteen pages it had just authored.
      _status: 'published',
      parent: parentId,
      ...(typeof n.navOrder === 'number' ? { navOrder: n.navOrder } : {}),
      ...(n.navLabel ? { navLabel: n.navLabel } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    overrideAccess: true,
  })
  console.log(`  ${n.slug} -> under ${n.parentSlug}`)
}

/* --------------------------------------------------------------------- nav */

// Rebuild the bar with the children marked as children: applyBrochureNav gives
// a page with a parent NO top-level row, because the header hangs it off the
// parent's item at render time. Without this the fourteen would sit in the bar
// as well as in the dropdowns.
const TOP: Array<{ slug: string; title: string; showInNav?: boolean }> = [
  { slug: 'home', title: 'Home', showInNav: false },
  { slug: 'services', title: 'Services' },
  { slug: 'solutions', title: 'Solutions' },
  { slug: 'about', title: 'About' },
  { slug: 'careers', title: 'Careers' },
  { slug: 'contact', title: 'Contact Us' },
]
const navPages = [
  ...TOP,
  ...nesting.map((n) => ({ slug: n.slug, title: n.navLabel || n.slug, parent: n.parentSlug })),
]
const nav = await applyBrochureNav(payload, TENANT, navPages, {
  hidePlatformRoutes: true,
  alsoHide: ['/book', '/posts'],
})
console.log(`nav: ${nav.navItems} top-level items, ${nav.hidden.length} routes hidden`)
console.log('done — https://celersoft.spacesangels.com')
