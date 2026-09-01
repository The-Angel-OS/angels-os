/**
 * Demo-site templates — the content half of "I'll build your site for free".
 *
 * A prospect gives us a business name and a trade. That is genuinely all we
 * need: everything a brochure site says about a cleaning company is the same
 * except the name, and the parts that AREN'T the same (their prices, their
 * story) are exactly the parts they should be editing themselves anyway.
 *
 * So this is a small per-trade CONTENT PACK — services, the questions their
 * customers actually ask, a palette — fed through the same `sections[]` spec
 * that builds every other site on the platform. No per-client template files
 * and no forks: adding a trade is a table entry.
 *
 * @see src/utilities/provisionPagesFromSpec.ts
 */
import type { PageFromSpec } from './provisionPagesFromSpec'

export interface TradePack {
  label: string
  /** Fallback tagline when the prospect didn't give us one. */
  tagline: (city?: string) => string
  primaryColor: string
  secondaryColor: string
  /** Dark suits trades and photography; service and finance read better light. */
  defaultTheme: 'auto' | 'light' | 'dark'
  services: Array<{ name: string; blurb: string }>
  faq: Array<{ question: string; answer: string }>
  /** Prompt seed for a generated hero. Deliberately no people, no text, no logos. */
  heroPrompt: string
  /**
   * The VOICE overrides. Everything below is optional and defaults to the
   * small-local-business copy that every pack used to get for free.
   *
   * That default is not neutral — "locally owned", "the people who answer the
   * phone are the people who do the work", "Licensed & Insured" are the right
   * words for a handyman and actively wrong for a consultancy with offices on
   * three continents. Before this the copy was hard-coded in
   * `buildDemoSiteSpec`, so the only way to pitch a B2B firm was a second
   * template file — i.e. a fork. These four fields are what a fork would have
   * changed, so a new voice stays a table entry like everything else.
   */
  voice?: {
    /** The four trust-row badges. */
    trust?: Array<{ icon: string; label: string; detail?: string }>
    /** Home page opening, after the `Welcome to <name>` heading. */
    intro?: (ctx: VoiceContext) => string[]
    /** About page body, after the `Who we are` heading. */
    about?: (ctx: VoiceContext) => string[]
    /** Pages appended after FAQ, before Contact. Numbered from navOrder 4. */
    extraPages?: (ctx: VoiceContext) => PageFromSpec[]
  }
}

/** What a pack's voice functions get to work with. */
export interface VoiceContext {
  name: string
  city?: string
  tagline: string
  /** `phone · email`, or '' when we have neither. */
  contactLine: string
}

const MONEY = 'Straightforward pricing, quoted before any work starts.'

export const TRADE_PACKS: Record<string, TradePack> = {
  handyman: {
    label: 'Handyman & Home Repair',
    tagline: (city) => `Repairs done right the first time${city ? ` in ${city}` : ''}.`,
    primaryColor: '#D97706',
    secondaryColor: '#1F2937',
    defaultTheme: 'dark',
    heroPrompt:
      'Clean well-lit photograph of professional hand tools laid out on a wooden workbench, shallow depth of field, no people, no text, no logos',
    services: [
      { name: 'Plumbing Repairs', blurb: 'Leaks, running toilets, faucet and fixture replacement.' },
      { name: 'Electrical Work', blurb: 'Outlets, switches, light fixtures and ceiling fans.' },
      { name: 'Drywall Repair', blurb: 'Holes, cracks and water damage patched and finished to blend.' },
      { name: 'Appliance Installation', blurb: 'Dishwashers, ranges, washers and dryers hooked up properly.' },
      { name: 'Doors & Flooring', blurb: 'Doors that stick, locks that fail, floors that need replacing.' },
      { name: 'Rental Turnovers', blurb: 'Whole-unit punch lists between tenants, on a schedule.' },
    ],
    faq: [
      { question: 'How do you price a job?', answer: `${MONEY}\n\nSend photos of what needs doing and you will have a number before anyone turns up.` },
      { question: 'How soon can you come out?', answer: 'Same-day and next-day slots are usually available, and emergencies get priority.' },
      { question: 'Do you work for landlords and property managers?', answer: 'Yes — turnovers, punch lists and ongoing maintenance, invoiced per property.' },
      { question: 'Are you licensed and insured?', answer: 'Yes. Certificates are available on request before any work begins.' },
    ],
  },
  cleaning: {
    label: 'Cleaning Services',
    tagline: (city) => `Reliable home and office cleaning${city ? ` in ${city}` : ''}.`,
    primaryColor: '#0EA5E9',
    secondaryColor: '#334155',
    defaultTheme: 'light',
    heroPrompt:
      'Bright airy photograph of a spotlessly clean sunlit living room, soft natural light, no people, no text, no logos',
    services: [
      { name: 'Residential Cleaning', blurb: 'Whole-home cleaning, one-time or on a recurring schedule.' },
      { name: 'Commercial & Offices', blurb: 'Offices and buildings cleaned after hours on a fixed schedule.' },
      { name: 'Recurring Service', blurb: 'Weekly, fortnightly or monthly, with the same team each visit.' },
      { name: 'Move-In / Move-Out', blurb: 'Deep cleaning for the end of a lease or the start of one.' },
      { name: 'Post-Construction', blurb: 'Dust, debris and residue cleared after a renovation or build.' },
    ],
    faq: [
      { question: 'What does it cost?', answer: `${MONEY}\n\nMost homes are quoted after a short walkthrough or a few photos.` },
      { question: 'Do I need to be home?', answer: 'No. Plenty of clients arrange access and come back to a finished house.' },
      { question: 'Do you bring your own supplies?', answer: 'Yes — products and equipment are included, unless you would rather we used yours.' },
      { question: 'Can I book the same team every time?', answer: 'Yes. Recurring clients get the same crew wherever scheduling allows.' },
    ],
  },
  moving: {
    label: 'Moving & Labor',
    tagline: (city) => `Careful, on-time local moving${city ? ` in ${city}` : ''}.`,
    primaryColor: '#DC2626',
    secondaryColor: '#1F2937',
    defaultTheme: 'light',
    heroPrompt:
      'Photograph of neatly stacked moving boxes and furniture blankets in a clean empty room, warm light, no people, no text, no logos',
    services: [
      { name: 'Local Residential Moves', blurb: 'Houses and apartments moved across town.' },
      { name: 'Loading & Unloading', blurb: 'Labor only for your rental truck, trailer, POD or container.' },
      { name: 'Packing Assistance', blurb: 'Full or partial packing, with materials if you need them.' },
      { name: 'Furniture Assembly', blurb: 'Disassembly and reassembly, including the awkward pieces.' },
      { name: 'Heavy Item Specialists', blurb: 'Pianos, safes, appliances and tight staircases.' },
      { name: 'Senior Moving Assistance', blurb: 'Patient, unhurried help with downsizing and relocation.' },
    ],
    faq: [
      { question: 'How is a move priced?', answer: `${MONEY}\n\nCrew size and hours are agreed up front. Stairs, distance and inventory all change the number, so we ask about them before quoting.` },
      { question: 'Do you have last-minute availability?', answer: 'Often yes, including evenings and weekends. Short notice is always worth asking about.' },
      { question: 'What if my other movers cancelled?', answer: 'That is a large share of the work we do. Call and we will tell you honestly what we can cover.' },
      { question: 'Do you bring equipment?', answer: 'Dollies, straps, tools and blankets come with the crew.' },
    ],
  },
  photography: {
    label: 'Photography',
    tagline: (city) => `Portrait and event photography${city ? ` in ${city}` : ''}.`,
    primaryColor: '#C8A16B',
    secondaryColor: '#2A2A2E',
    defaultTheme: 'dark',
    heroPrompt:
      'Moody photograph of a professional camera and softbox lighting in a dim studio, dramatic rim light, no people, no text, no logos',
    services: [
      { name: 'Portrait Sessions', blurb: 'Studio or on location, planned around what you want the images for.' },
      { name: 'Events', blurb: 'Coverage that captures the day without interrupting it.' },
      { name: 'Business & Headshots', blurb: 'Consistent professional headshots for a whole team.' },
      { name: 'Product Photography', blurb: 'Clean, well-lit images built for listings and catalogues.' },
    ],
    faq: [
      { question: 'How long is a session?', answer: 'Most run one to two hours. The best frames usually come near the end, once everyone has relaxed.' },
      { question: 'What do I get afterwards?', answer: 'Edited high-resolution images, delivered digitally, with the usage rights written down before the shoot.' },
      { question: 'What should I bring?', answer: 'More wardrobe than you think you need, in a range of tones.' },
      { question: 'How far ahead should I book?', answer: 'A couple of weeks is typical, and more in peak season.' },
    ],
  },
  accounting: {
    label: 'Bookkeeping & Tax',
    tagline: (city) => `Bookkeeping and tax help${city ? ` for ${city} businesses` : ''}.`,
    primaryColor: '#047857',
    secondaryColor: '#1F2937',
    defaultTheme: 'light',
    heroPrompt:
      'Calm photograph of an organized desk with ledgers and a calculator, soft daylight, no people, no text, no logos',
    services: [
      { name: 'Monthly Bookkeeping', blurb: 'Books kept current so nothing becomes a scramble in April.' },
      { name: 'Tax Preparation', blurb: 'Personal, sole proprietor and corporate returns.' },
      { name: 'Back Taxes & Catch-Up', blurb: 'Years behind is a solvable problem, handled quietly and without judgment.' },
      { name: 'Payroll Support', blurb: 'Payroll run correctly and filed on time.' },
      { name: 'Business Setup', blurb: 'Entity setup, and the accounting that should come with it.' },
    ],
    faq: [
      { question: 'I am several years behind. Is that a problem?', answer: 'No, and you are not unusual. Catching up is routine work — the first step is simply finding out where things stand.' },
      { question: 'Do I have to come to an office?', answer: 'Whatever suits you: your place, ours, or entirely remote.' },
      { question: 'What does it cost?', answer: `${MONEY}\n\nThe first conversation is free.` },
      { question: 'How do I send my documents?', answer: 'We will agree a secure method before anything sensitive changes hands.' },
    ],
  },
  landscaping: {
    label: 'Lawn Care & Landscaping',
    tagline: (city) => `Lawns cut, yards cleared, driveways washed${city ? ` in ${city}` : ''}.`,
    primaryColor: '#15803D',
    secondaryColor: '#1F2937',
    defaultTheme: 'light',
    heroPrompt:
      'Clean photograph of a freshly cut suburban lawn with crisp mower stripes and a tidy edged border, warm morning light, no people, no text, no logos',
    services: [
      { name: 'Lawn Mowing', blurb: 'Cut, trimmed and blown clean. Weekly, biweekly or one-off.' },
      { name: 'Weed Eating & Edging', blurb: 'Clean lines along drives, walks and beds — the part that makes a yard look finished.' },
      { name: 'Landscape Design', blurb: 'Beds, plantings and mulch laid out to suit the house and the light it gets.' },
      { name: 'Pressure Washing', blurb: 'Driveways, walkways, siding and fences brought back to their original color.' },
      { name: 'Junk Removal', blurb: 'Yard debris, storm damage and the pile behind the shed, hauled away.' },
      { name: 'Fencing & Repairs', blurb: 'Fence lines, painting and the small outdoor repairs that keep getting put off.' },
    ],
    faq: [
      { question: 'How do you price a yard?', answer: `${MONEY}

Lot size and how long it has been since the last cut are what move the number. A free estimate settles it before anyone starts.` },
      { question: 'Do you cut on a schedule?', answer: 'Yes — weekly and biweekly routes are the usual arrangement, and one-off cleanups are welcome too.' },
      { question: 'What if it rains on my day?', answer: 'The route shifts to the next dry day. You will hear about it rather than wonder.' },
      { question: 'Are you licensed and insured?', answer: 'Yes. Certificates are available on request before any work begins.' },
    ],
  },
  legal: {
    label: 'Legal Services',
    tagline: (city) => `Straightforward legal help at a fixed fee${city ? ` in ${city}` : ''}.`,
    primaryColor: '#1D4ED8',
    secondaryColor: '#1F2937',
    defaultTheme: 'light',
    heroPrompt:
      'Calm photograph of a tidy desk with a closed folder and a fountain pen by a window, soft daylight, no people, no text, no logos, no signage',
    // Deliberately narrow and non-committal. Lawyer advertising is regulated
    // (Florida Rule 4-7): no outcome promises, no comparative or superlative
    // claims, no testimonials, and nothing that reads as advice to a reader who
    // is not yet a client. Prices belong here ONLY when the attorney published
    // them; otherwise the FAQ says to ask.
    services: [
      { name: 'Uncontested Divorce', blurb: 'A dissolution both spouses agree to, prepared and filed at a flat fee agreed up front.' },
      { name: 'Simple Probate', blurb: 'Small-estate probate — the paperwork needed to release a modest bank account to the right person.' },
      { name: 'Virtual Consultations', blurb: 'Handled by video and email. No office visit unless you want one.' },
      { name: 'Document Preparation', blurb: 'Forms completed correctly the first time, so the clerk does not send them back.' },
    ],
    faq: [
      { question: 'What does it cost?', answer: 'Flat fees, quoted in writing before any work begins, so the number does not move. Court filing fees are separate and set by the clerk.' },
      { question: 'Is my matter actually uncontested?', answer: 'Uncontested means both parties agree on everything and neither is asking a judge to decide. If that is not your situation, say so at the outset — it changes what is involved.' },
      { question: 'Can this be done without coming to an office?', answer: 'Yes. Consultations are held by video and documents are handled electronically, apart from anything the court requires in person.' },
      { question: 'How long does it take?', answer: 'It depends on the court\'s calendar rather than on us. You will be told what to expect for your county before you commit.' },
    ],
  },
  techsupport: {
    label: 'Computer Repair & IT Help',
    tagline: (city) => `Onsite computer help, and I come to you${city ? ` in ${city}` : ''}.`,
    primaryColor: '#0F766E',
    secondaryColor: '#1F2937',
    defaultTheme: 'light',
    heroPrompt:
      'Clean photograph of a laptop open on a kitchen table beside a notepad and a mug, warm domestic daylight, no people, no text, no logos',
    services: [
      { name: 'PC Troubleshooting & Repair', blurb: 'The machine that will not start, will not print, or has slowed to a crawl \u2014 diagnosed at your table.' },
      { name: 'Virus & Malware Removal', blurb: 'Pop-ups, hijacked browsers and the messages telling you to call a number. Cleaned out and made safe again.' },
      { name: 'SSD Upgrade & Cloning', blurb: 'Your drive copied to a solid-state one, everything where you left it, on a computer that boots in seconds.' },
      { name: 'Home & Small Business Networking', blurb: 'Wi-Fi that reaches the far room, printers everyone can see, and a network that stays up.' },
      { name: 'New Computer & Printer Setup', blurb: 'Out of the box to actually working, with your files, mail and bookmarks carried across.' },
      { name: 'Data Transfer & Recovery', blurb: 'Photos and documents off an old or failing machine before they are lost for good.' },
      { name: 'Smart TV & Streaming Setup', blurb: 'Roku, Fire Stick, Apple TV, Netflix and the rest, set up and explained once.' },
      { name: 'One-on-One Training', blurb: 'Patient, unhurried help at your own pace \u2014 in plain English, never tech-talk.' },
    ],
    faq: [
      { question: 'Do I have to bring my computer anywhere?', answer: 'No. This is mobile service \u2014 the work happens at your home or office, on your own desk, with your own printer and network in front of us.' },
      { question: 'What does it cost?', answer: `${MONEY}

Most jobs are straightforward and quoted before any work starts. You will know the number before anyone touches the machine.` },
      { question: 'Can you explain it without the jargon?', answer: 'That is the point. Everything gets explained in plain English as it happens, and you are welcome to watch and ask questions.' },
      { question: 'What if it cannot be fixed?', answer: 'Then you get told that plainly, along with what your options are and what they would cost \u2014 including doing nothing.' },
    ],
  },
  /**
   * Enterprise IT consultancy - the B2B pack.
   *
   * Every other pack sells to a homeowner: one decision-maker, a job that takes
   * an afternoon, and a page whose whole argument is "we are local and we turn
   * up". This one sells to a procurement committee. The services are practices
   * rather than jobs, the FAQ answers the questions a CIO asks instead of the
   * ones a customer asks, and the trust row talks about certifications and
   * delivery model because "Licensed & Insured" means nothing to an enterprise
   * buyer.
   *
   * It carries an extra page the other packs do not: a security-assessment
   * intake. For this kind of firm the readiness assessment IS the lead magnet -
   * it is the one thing on the site a stranger will trade an email address for -
   * so the pack ships it wired to the contact form rather than as copy.
   */
  enterprise: {
    label: 'Enterprise IT Services & Consulting',
    tagline: (city) =>
      `Infrastructure, data and security consulting for the enterprise${city ? `, from ${city}` : ''}.`,
    primaryColor: '#1D4ED8',
    secondaryColor: '#0F172A',
    defaultTheme: 'dark',
    heroPrompt:
      'Clean architectural photograph of a modern data center aisle, cool blue lighting, deep perspective, no people, no text, no logos',
    services: [
      {
        name: 'Infrastructure Solutions',
        blurb:
          'Cloud, data center, private 5G and network estates designed, migrated and run as one program rather than a series of projects.',
      },
      {
        name: 'Business Analytics',
        blurb:
          'Warehouses, pipelines and dashboards that answer the questions the business actually asks, with the AI layer on top of governed data rather than instead of it.',
      },
      {
        name: 'ERP Solutions',
        blurb:
          'SAP and Oracle implementation, upgrade and integration - including the interfaces to everything the ERP was never meant to talk to.',
      },
      {
        name: 'Cybersecurity',
        blurb:
          'SOC operations, zero-trust architecture and SIEM, plus the compliance evidence that turns good practice into a passed audit.',
      },
      {
        name: 'Microservices & DevOps',
        blurb:
          'Containers, APIs and delivery pipelines - decomposing the monolith without stopping the business that depends on it.',
      },
      {
        name: 'Managed Services',
        blurb:
          '24x7 monitoring and enterprise IT operations, so the estate has an owner on the days nothing is being built.',
      },
      {
        name: 'IT Staffing',
        blurb:
          'Engineers, architects and delivery leads placed onto your program, screened by people who have done the work themselves.',
      },
    ],
    faq: [
      {
        question: 'How do engagements start?',
        answer:
          'With an assessment, not a proposal. We map what you have, what is actually breaking, and what it would cost to leave it alone - then scope against that. The assessment stands on its own even if you go no further.',
      },
      {
        question: 'Do you work alongside our existing teams and vendors?',
        answer:
          'Usually, yes. Most of this work happens inside estates that already have incumbents, and the job is to make the whole thing function rather than to replace everyone in it.',
      },
      {
        question: 'What if the original vendor is gone and there is no source code?',
        answer:
          'That is a normal starting condition, not a blocker. Systems get diagnosed empirically - observed behavior, decompilation where it is warranted, and a rebuild that stays close enough to the original that the next engineer can still read it.',
      },
      {
        question: 'How is delivery structured across time zones?',
        answer:
          'Onshore leadership with offshore delivery capacity, run as one team against one backlog. Handover is a standing part of the engagement rather than a closing phase.',
      },
      {
        question: 'What happens to the knowledge when the engagement ends?',
        answer:
          'It is written down while the work is happening: standards, runbooks and a knowledge base your team owns. An engagement that leaves capability behind is the only kind worth selling twice.',
      },
    ],
    voice: {
      trust: [
        { icon: 'shield', label: 'SOC 2 & ISO 27001', detail: 'Readiness and audit support' },
        { icon: 'support', label: '24x7 Managed Services', detail: 'Monitoring and IT operations' },
        { icon: 'star', label: 'Global Delivery', detail: 'USA, Canada and India' },
        { icon: 'rosette', label: 'Certified Partners', detail: 'Cloud, ERP and security stacks' },
      ],
      intro: ({ name, tagline }) => [
        `${tagline} ${name} works inside enterprise estates - the ones with real dependencies, real compliance obligations, and no window in which everything can simply stop.`,
        'Our offerings span business and technology consulting, infrastructure, business analytics, ERP, cybersecurity, microservices and IT staffing. Most clients start with one and stay for several.',
      ],
      about: ({ name, city }) => [
        `${name} is an enterprise technology consultancy${city ? ` headquartered in ${city}` : ''}, delivering across North America and India.`,
        'This page is where the firm tells its own story - when it was founded, the industries it serves, and the engagements it is proudest of. Everything on this site is editable, and none of it is locked.',
        'We assess before we propose, we staff engagements with the people who will actually do the work, and we write down what we learn so the capability outlasts the contract.',
      ],
      extraPages: ({ name, contactLine }) => [
        {
          slug: 'assessment',
          title: 'Security Assessment',
          navOrder: 4,
          heroType: 'splitPanel' as const,
          heroHeading: 'SOC 2 & ISO 27001 Readiness Assessment',
          heroSub: 'Find out where the gaps are before an auditor does.',
          meta: {
            title: 'SOC 2 & ISO 27001 Readiness Assessment',
            description: `Free readiness assessment from ${name} - control gap analysis and a prioritized remediation plan.`,
          },
          sections: [
            {
              content: [
                { h2: 'Know your gaps before the audit does' },
                {
                  p: 'Most organizations discover their compliance gaps during the audit, when every finding is expensive and the timeline belongs to somebody else. An assessment moves that discovery forward to while it is still cheap to act on.',
                },
                { h3: 'What the assessment covers' },
                {
                  p: 'Your existing security controls, mapped against the SOC 2 trust services criteria and the ISO 27001 Annex A controls.',
                },
                {
                  p: 'Compliance maturity - which controls exist, which are documented, and which are evidenced well enough to survive a sample request.',
                },
                {
                  p: 'Audit readiness, including the evidence you would need to produce and how long producing it would currently take you.',
                },
                { h3: 'What you get back' },
                {
                  p: 'A written gap analysis, a prioritized remediation plan, and a realistic timeline to audit readiness. Yours to keep, whether or not we do the remediation.',
                },
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
                  'A readiness assessment is preparation for an audit, not an audit - certification is issued by an accredited auditor, not by us.',
              },
            },
            {
              content: [
                { h2: 'Request your assessment' },
                {
                  p: contactLine
                    ? `Send the form below and someone will come back to you the same business day, or reach us directly on ${contactLine}.`
                    : 'Send the form below and someone will come back to you the same business day.',
                },
              ],
            },
            { contactForm: true },
          ],
        },
      ],
    },
  },
  general: {
    label: 'Local Business',
    tagline: (city) => `Dependable local service${city ? ` in ${city}` : ''}.`,
    primaryColor: '#2563EB',
    secondaryColor: '#1F2937',
    defaultTheme: 'light',
    heroPrompt:
      'Warm photograph of a small local storefront at golden hour, inviting and clean, no people, no text, no logos',
    services: [
      { name: 'Our Services', blurb: 'Tell your customers what you do, in your own words.' },
      { name: 'Free Estimates', blurb: 'Quote the work before it starts so nobody is surprised.' },
      { name: 'Local & Reliable', blurb: 'Serving the area with work you can stand behind.' },
    ],
    faq: [
      { question: 'How do I get a quote?', answer: 'Send a message through the contact form and you will hear back the same day.' },
      { question: 'What areas do you serve?', answer: 'The local area and the surrounding communities.' },
      { question: 'What does it cost?', answer: MONEY },
    ],
  },
}

export const TRADE_KEYS = Object.keys(TRADE_PACKS)

/**
 * Resolve free text ('house cleaning', 'MOVERS', 'HVAC contractor') onto a pack.
 * Prospects describe their trade in their own words; this is the only place
 * that has to care.
 */
export function resolveTradePack(input?: string): { key: string; pack: TradePack } {
  const t = (input || '').toLowerCase().trim()
  if (t && TRADE_PACKS[t]) return { key: t, pack: TRADE_PACKS[t]! }
  const has = (...needles: string[]) => needles.some((n) => t.includes(n))
  // Before 'clean': "lawn care and pressure washing" must not land on maid service.
  if (has('lawn', 'landscap', 'mow', 'yard', 'garden', 'pressure wash', 'power wash', 'tree'))
    return { key: 'landscaping', pack: TRADE_PACKS.landscaping! }
  if (has('clean', 'maid', 'janitor')) return { key: 'cleaning', pack: TRADE_PACKS.cleaning! }
  // NOT 'mov': "removal" contains it, so "virus removal" and "junk removal"
  // both landed on a moving company. Caught by the techsupport pack's tests.
  if (has('moving', 'mover', 'move ', 'haul', 'relocat'))
    return { key: 'moving', pack: TRADE_PACKS.moving! }
  if (has('photo', 'video', 'studio')) return { key: 'photography', pack: TRADE_PACKS.photography! }
  if (has('tax', 'account', 'bookkeep', 'payroll', 'cpa')) return { key: 'accounting', pack: TRADE_PACKS.accounting! }
  // Before 'handy'/'repair': "probate" and "divorce" are not home maintenance.
  if (has('legal', 'attorney', 'lawyer', 'law firm', 'divorce', 'probate', 'estate plan', 'paralegal'))
    return { key: 'legal', pack: TRADE_PACKS.legal! }
  // Before techsupport: an enterprise consultancy trips 'network' and ' it ',
  // and would otherwise be sold to as a mobile PC-repair guy. The tell is the
  // enterprise vocabulary, which a homeowner never uses.
  if (
    has(
      'enterprise',
      'consult',
      'erp',
      'sap',
      'oracle',
      'cybersecur',
      'siem',
      'zero trust',
      'devops',
      'microservice',
      'kubernetes',
      'data center',
      'datacenter',
      'managed service',
      'staffing',
      'system integrat',
      'systems integrat',
      'digital transformation',
      'analytics',
      'msp',
    )
  )
    return { key: 'enterprise', pack: TRADE_PACKS.enterprise! }
  // Before 'repair'/'electric': "computer repair" is not home maintenance, and
  // "electronics" is not an electrician.
  if (
    has(
      'computer',
      'pc ',
      'laptop',
      ' it ',
      'it support',
      'tech support',
      'techsupport',
      'network',
      'wifi',
      'wi-fi',
      'virus',
      'malware',
      'smart tv',
      'geek',
    )
  )
    return { key: 'techsupport', pack: TRADE_PACKS.techsupport! }
  if (has('handy', 'repair', 'plumb', 'electric', 'hvac', 'contractor', 'remodel', 'maintenance'))
    return { key: 'handyman', pack: TRADE_PACKS.handyman! }
  return { key: 'general', pack: TRADE_PACKS.general! }
}

export interface DemoSiteInput {
  businessName: string
  trade?: string
  city?: string
  phone?: string
  email?: string
  tagline?: string
  /** Media id for the hero, once one has been generated or uploaded. */
  heroMedia?: number
}

/**
 * Build the page spec for a demo site: home, services, about, faq, contact.
 *
 * Five pages because that is the shape of every small-business site that works
 * — and because a prospect comparing this against "seven pages of content for
 * $59" should not be counting pages and coming up short.
 */
export function buildDemoSiteSpec(input: DemoSiteInput): PageFromSpec[] {
  const { pack } = resolveTradePack(input.trade)
  const name = input.businessName
  const city = input.city
  const tagline = input.tagline || pack.tagline(city)
  const where = city ? ` in ${city}` : ''
  const contactLine = [input.phone, input.email].filter(Boolean).join(' · ')
  const hero = input.heroMedia

  const voice = pack.voice || {}
  const ctx: VoiceContext = { name, city, tagline, contactLine }

  const serviceNodes = pack.services.flatMap((s) => [{ h3: s.name }, { p: s.blurb }])
  // Without a hero image every page would open on a bare heading, so the
  // treatment degrades to lowImpact rather than rendering an empty banner.
  const heroType = (withImage: 'fullScreen' | 'splitPanel') => (hero ? withImage : 'lowImpact')
  const heroImage = hero ? { heroImage: hero } : {}

  return [
    {
      slug: 'home',
      title: 'Home',
      showInNav: false,
      navOrder: 0,
      heroType: heroType('fullScreen'),
      heroHeading: name,
      heroSub: tagline,
      ...heroImage,
      meta: { title: `${name} — ${pack.label}${where}`, description: tagline },
      sections: [
        {
          content: [
            { h2: `Welcome to ${name}` },
            ...(voice.intro
              ? voice.intro(ctx).map((p) => ({ p }))
              : [
                  { p: `${tagline} We are a local business, and the people who answer the phone are the people who do the work.` },
                  { p: 'Get in touch and you will hear back the same day — no call center, no runaround.' },
                ]),
          ],
        },
        {
          trustRow: {
            items: voice.trust || [
              { icon: 'shield', label: 'Licensed & Insured', detail: 'Certificates on request' },
              { icon: 'star', label: 'Locally Owned', detail: city || 'Serving the local area' },
              { icon: 'rosette', label: 'Free Estimates', detail: 'Quoted before work starts' },
              { icon: 'support', label: 'Same-Day Reply', detail: 'A real person, every time' },
            ],
          },
        },
        { content: [{ h2: 'What we do' }, ...serviceNodes] },
        {
          cta: {
            heading: 'Ready to get started?',
            body: contactLine
              ? `Call or message us on ${contactLine}, or send a note through the site and we will come straight back to you.`
              : 'Send us a note and we will come straight back to you.',
            links: [
              { label: 'Get a free estimate', url: '/contact' },
              { label: 'See our services', url: '/services', outline: true },
            ],
          },
        },
      ],
    },
    {
      slug: 'services',
      title: 'Services',
      navOrder: 1,
      heroType: heroType('splitPanel'),
      heroHeading: 'Services',
      heroSub: `What ${name} can do for you.`,
      ...heroImage,
      meta: { title: 'Services', description: `Services offered by ${name}${where}.` },
      sections: [
        { content: [{ h2: 'What we offer' }, ...serviceNodes] },
        {
          cta: {
            heading: 'Not sure what you need?',
            body: 'Describe the job and we will tell you honestly what it involves and what it costs.',
            links: [{ label: 'Ask a question', url: '/contact' }],
          },
        },
      ],
    },
    {
      slug: 'about',
      title: 'About',
      navOrder: 2,
      heroType: heroType('splitPanel'),
      heroHeading: `About ${name}`,
      heroSub: tagline,
      ...heroImage,
      meta: { title: 'About', description: `About ${name}${where}.` },
      sections: [
        {
          content: [
            { h2: 'Who we are' },
            ...(voice.about
              ? voice.about(ctx).map((p) => ({ p }))
              : [
                  {
                    p: `${name} is a locally owned ${pack.label.toLowerCase()} business${where}. This page is where you tell your story — how long you have been doing this, what you care about, and why someone should trust you with their home or their business.`,
                  },
                  { p: 'Replace this text with your own. Everything on this site is editable, and nothing here is locked.' },
                  { p: 'We quote before we start, we turn up when we said we would, and we stand behind the work. That is most of it.' },
                ]),
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
      slug: 'faq',
      title: 'FAQ',
      navOrder: 3,
      heroType: heroType('splitPanel'),
      heroHeading: 'Questions, answered',
      heroSub: 'The things people ask before they book.',
      ...heroImage,
      meta: { title: 'FAQ', description: `Common questions about ${name}.` },
      sections: [
        { faq: { heading: 'Before you book', openFirst: true, items: pack.faq } },
        {
          cta: {
            heading: 'Still wondering something?',
            body: 'Ask directly — we would rather answer now than have you guess.',
            links: [{ label: 'Ask a question', url: '/contact' }],
          },
        },
      ],
    },
    ...(voice.extraPages ? voice.extraPages(ctx) : []),
    {
      slug: 'contact',
      title: 'Contact',
      // After whatever the pack inserted, so Contact stays last in the bar.
      navOrder: 4 + (voice.extraPages ? voice.extraPages(ctx).length : 0),
      heroType: heroType('splitPanel'),
      heroHeading: 'Get in touch',
      heroSub: contactLine || 'Tell us what you need.',
      ...heroImage,
      meta: { title: 'Contact', description: `Contact ${name}${where}.` },
      sections: [
        {
          content: [
            { h2: 'Contact us' },
            {
              p: contactLine
                ? `Call or text ${contactLine}, or use the form below.`
                : 'Use the form below and we will come straight back to you.',
            },
            ...(city ? [{ p: `Serving ${city} and the surrounding area.` }] : []),
          ],
        },
        { contactForm: true },
      ],
    },
  ]
}
