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
  if (has('mov', 'haul', 'relocat')) return { key: 'moving', pack: TRADE_PACKS.moving! }
  if (has('photo', 'video', 'studio')) return { key: 'photography', pack: TRADE_PACKS.photography! }
  if (has('tax', 'account', 'bookkeep', 'payroll', 'cpa')) return { key: 'accounting', pack: TRADE_PACKS.accounting! }
  // Before 'handy'/'repair': "probate" and "divorce" are not home maintenance.
  if (has('legal', 'attorney', 'lawyer', 'law firm', 'divorce', 'probate', 'estate plan', 'paralegal'))
    return { key: 'legal', pack: TRADE_PACKS.legal! }
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
            { p: `${tagline} We are a local business, and the people who answer the phone are the people who do the work.` },
            { p: 'Get in touch and you will hear back the same day — no call center, no runaround.' },
          ],
        },
        {
          trustRow: {
            items: [
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
            {
              p: `${name} is a locally owned ${pack.label.toLowerCase()} business${where}. This page is where you tell your story — how long you have been doing this, what you care about, and why someone should trust you with their home or their business.`,
            },
            { p: 'Replace this text with your own. Everything on this site is editable, and nothing here is locked.' },
            { h2: 'How we work' },
            { p: 'We quote before we start, we turn up when we said we would, and we stand behind the work. That is most of it.' },
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
    {
      slug: 'contact',
      title: 'Contact',
      navOrder: 4,
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
