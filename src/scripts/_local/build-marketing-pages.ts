/**
 * The marketing site could not tell its own story.
 *
 * www was home, get-started, plans, pricing, contact plus legal pages. There was
 * no "how it works" and no gallery of finished sites, which meant the demo script
 * narrated things the site itself never says — and a visitor who wanted to
 * understand before signing up had nowhere to go but the pricing page.
 *
 * Two pages, built from the demo script's own copy so the video and the site say
 * the same thing in the same voice:
 *
 *   /how-it-works — what happens, in order, with the objections answered
 *   /examples     — real finished sites, with what each one demonstrates
 *
 * No Angel OS vocabulary in either. A plumber reading /how-it-works should never
 * learn the words "tenant", "portal", "endeavor" or "Payload".
 *
 * Run: node_modules/.bin/payload run src/scripts/_local/build-marketing-pages.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { provisionPagesFromSpec, type PageFromSpec } from '@/utilities/provisionPagesFromSpec'

const payload = await getPayload({ config })

const t = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: 'platform' } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenantId = (t.docs[0] as { id: number } | undefined)?.id
if (tenantId == null) {
  console.log('PLATFORM_TENANT_NOT_FOUND')
  process.exit(1)
}

const pages: PageFromSpec[] = [
  {
    slug: 'how-it-works',
    title: 'How It Works',
    showInNav: true,
    navOrder: 2,
    heroType: 'lowImpact',
    heroHeading: 'How it works',
    heroSub: 'Four steps, and you can stop after the first one.',
    meta: {
      title: 'How It Works — The Angel OS',
      description:
        'Tell us your business name and what you do. We build you a real website today and send you the link. You look at it, then decide.',
    },
    sections: [
      {
        content: [
          { h2: 'Step one: tell us what you do' },
          {
            p: 'Your business name, what you do, and the town you do it in. That is the whole form. It takes about a minute, and we do not ask for a card.',
          },
        ],
      },
      {
        content: [
          { h2: 'Step two: we build it — today' },
          {
            p: 'Not a template with your name dropped into it. A real site with pages that suit your trade: what you offer, who you are, how to reach you, and a way for customers to get in touch.',
          },
          {
            p: 'You get a link. Your site is live at your own address on our domain, and it stays that way for as long as you like.',
          },
        ],
      },
      {
        content: [
          { h2: 'Step three: look at it, then decide' },
          {
            p: 'This is the part most people do not believe until they see it. There is no proposal, no discovery call and no deposit. The thing is already built. If you do not like it, you have lost a minute and nobody will chase you.',
          },
          {
            p: 'If you do like it, change anything you want. Ask for a change in plain words, or open the editor and move things around yourself. Both work, and neither needs a developer.',
          },
        ],
      },
      {
        content: [
          { h2: 'Step four: let it do some work' },
          {
            p: 'Publish your hours and customers can book you online. Take deposits when you are ready. Sell something. Keep your customer list and let follow-ups go out on their own.',
          },
          {
            p: 'Booking is free on every plan, including the free one. If you have not connected a payment account, a booking arrives as a request instead of a charge — nothing is taken from your customer, and nothing is taken from you.',
          },
        ],
      },
      {
        trustRow: {
          items: [
            { icon: 'star', label: 'Free to look', detail: 'Built before you pay anything' },
            { icon: 'shield', label: 'You own it', detail: 'Your content, your domain' },
            { icon: 'rosette', label: 'Cancel anytime', detail: 'No contract, no exit fee' },
            { icon: 'support', label: 'A real person', detail: 'We answer, not a ticket queue' },
          ],
        },
      },
      {
        faq: {
          heading: 'The questions everybody asks',
          items: [
            {
              question: 'What is the catch?',
              answer:
                'There is not one, but here is the honest arithmetic. We build the first site free because it costs us very little to do and because showing you is better than telling you. Some people upgrade for their own domain name and online booking with deposits. Most of what we build stays free, and that is fine.',
            },
            {
              question: 'Do I own my website?',
              answer:
                'Yes. Your words, your pictures and your customer list are yours, and you can export them and leave at any time. If you bring your own domain name, the site lives at your address and our name disappears from it entirely.',
            },
            {
              question: 'What if I already have a website?',
              answer:
                'Then look at both and keep the better one. We will build ours from what you already have online, so it is a fair comparison rather than a blank page.',
            },
            {
              question: 'Do I need to be technical?',
              answer:
                'No. If you can write a text message you can change your website — describe the change and it gets made. If you would rather do it by hand, the editor is drag-and-drop, and nothing you save goes live until you publish it.',
            },
            {
              question: 'Can customers book and pay me?',
              answer:
                'Yes. Publish your hours and what you offer, and people can take a slot. Booking works on every plan. Taking a deposit needs a payment account connected — until then a booking arrives as a request, and nobody is charged.',
            },
            {
              question: 'How long until it is live?',
              answer:
                'It already is. We build the site before we email you, so the link in that email is a working website, not a preview.',
            },
          ],
        },
      },
      {
        cta: {
          heading: 'Ready to see yours?',
          body: 'Tell us the business name and what you do. Look at what comes back, then decide.',
          links: [
            { label: 'Build my free website', url: '/get-started' },
            { label: 'See real examples', url: '/examples', outline: true },
          ],
        },
      },
    ],
  },
  {
    slug: 'examples',
    title: 'Examples',
    showInNav: true,
    navOrder: 3,
    heroType: 'lowImpact',
    heroHeading: 'Real sites, real businesses',
    heroSub: 'Every one of these is live. Click into any of them and look around.',
    meta: {
      title: 'Examples — The Angel OS',
      description:
        'Live websites built on The Angel OS: wedding photography, a ministry, a church. Click into any of them.',
    },
    sections: [
      {
        content: [
          { h2: 'These are not mockups' },
          {
            p: 'Each one is a working website at its own address, run by the person whose name is on it. They were all built the same way, on the same system, in minutes — what differs is the content and what each owner needed.',
          },
        ],
      },
      {
        content: [
          { h3: 'PayneMediaCo — wedding photography' },
          {
            p: 'Galleries, wedding films, and a booking calendar that takes real dates. Each wedding is its own page with its own gallery, and adding the next one is filling in a form.',
          },
          { p: 'paynemediaco.spacesangels.com' },
        ],
      },
      {
        content: [
          { h3: "Clearwater Cruisin' Ministries" },
          {
            p: 'Twenty-one articles, a shop, and a booking calendar on one site. The case for one place doing writing, selling and scheduling instead of three services that do not talk to each other.',
          },
          { p: 'clearwater-cruisin.spacesangels.com' },
        ],
      },
      {
        content: [
          { h3: 'Grace Chapel' },
          {
            p: 'A church, which needs almost nothing a photographer needs. Same system underneath, entirely different face — no fork, no separate product.',
          },
          { p: 'grace-chapel.spacesangels.com' },
        ],
      },
      {
        cta: {
          heading: 'Yours could be next on this page',
          body: 'Tell us your business name and what you do. We will build it today and send you the link.',
          links: [
            { label: 'Build my free website', url: '/get-started' },
            { label: 'How it works', url: '/how-it-works', outline: true },
          ],
        },
      },
    ],
  },
]

const result = await provisionPagesFromSpec(payload, tenantId, pages, { overwrite: true })
console.log('PAGES', JSON.stringify(result))
console.log('DONE https://www.spacesangels.com/how-it-works')
process.exit(0)
