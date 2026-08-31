/**
 * Build the voiceover deck from docs/demo-shots/*.png.
 *
 * Narration lives in SPEAKER NOTES, not on the slides, because PowerPoint can
 * record voiceover per slide (Slide Show → Record) and export straight to video.
 * That means Ken records at his own pace and can redo one slide without redoing
 * the take — which a rendered video or an HTML deck would not allow.
 *
 * Chapter slides between acts are text-only on purpose: they are the beats where
 * the narrator is talking and the viewer should be listening, not reading a UI.
 *
 * Run: node src/scripts/_local/build-demo-deck.mjs
 * Out: docs/The-Angel-OS-Demo.pptx
 */
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { execSync } from 'child_process'

// pptxgenjs is installed GLOBALLY, not in this repo — it is a one-off authoring
// tool, and adding a dependency to the app for a script that builds a slide deck
// is not a trade worth making. ESM ignores NODE_PATH, so resolve it by hand.
const require = createRequire(import.meta.url)
const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim()
const pptxgen = require(join(globalRoot, 'pptxgenjs'))

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const SHOTS = join(ROOT, 'docs', 'demo-shots')
const OUT = join(ROOT, 'docs', 'The-Angel-OS-Demo.pptx')

// Dark, because the product is dark. Amber is the Angel OS accent; the green is
// the one the marketing site already uses for its calls to action.
const INK = '121212'
const PAPER = 'F4F4F4'
const AMBER = 'E0A756'
const GREEN = '22CC88'
const MUTED = '9A9A9A'

const HEAD = 'Cambria'
const BODY = 'Calibri'

const pres = new pptxgen()
pres.layout = 'LAYOUT_WIDE' // 13.3 x 7.5
pres.author = 'The Angel OS'
pres.title = 'The Angel OS — product demo'

const shot = (n) => {
  const f = join(SHOTS, n)
  if (!existsSync(f)) throw new Error('missing shot: ' + n)
  return f
}

/** A screenshot slide: title above, 16:9 capture below, narration in the notes. */
function shotSlide({ title, file, notes, kicker }) {
  const s = pres.addSlide()
  s.background = { color: INK }
  s.addText(title, {
    x: 0.9, y: 0.26, w: 11.5, h: 0.5,
    fontFace: HEAD, fontSize: 26, bold: true, color: PAPER,
    isTextBox: true, margin: 0,
  })
  if (kicker) {
    s.addText(kicker, {
      x: 0.9, y: 0.74, w: 11.5, h: 0.28,
      fontFace: BODY, fontSize: 12, color: MUTED,
      isTextBox: true, margin: 0,
    })
  }
  s.addImage({
    path: shot(file),
    x: 1.05, y: kicker ? 1.08 : 0.92, w: 11.2, h: 6.3,
    shadow: { type: 'outer', color: '000000', blur: 18, offset: 4, angle: 90, opacity: 0.55 },
  })
  s.addNotes(notes)
  return s
}

/** A beat between acts — text only, because here the viewer should be listening. */
function chapter({ eyebrow, title, sub, notes, accent = AMBER }) {
  const s = pres.addSlide()
  s.background = { color: INK }
  s.addText(eyebrow.toUpperCase(), {
    x: 1.1, y: 2.35, w: 11, h: 0.35,
    fontFace: BODY, fontSize: 13, bold: true, color: accent, charSpacing: 3,
    isTextBox: true, margin: 0,
  })
  s.addText(title, {
    x: 1.1, y: 2.8, w: 11, h: 1.5,
    fontFace: HEAD, fontSize: 46, bold: true, color: PAPER,
    isTextBox: true, margin: 0,
  })
  if (sub) {
    s.addText(sub, {
      x: 1.1, y: 4.35, w: 9.6, h: 0.9,
      fontFace: BODY, fontSize: 17, color: MUTED,
      isTextBox: true, margin: 0,
    })
  }
  s.addNotes(notes)
  return s
}

/* ── Title ──────────────────────────────────────────────────────────────── */
{
  const s = pres.addSlide()
  s.background = { color: INK }
  s.addText('The Angel OS', {
    x: 1.1, y: 2.5, w: 11, h: 1.3,
    fontFace: HEAD, fontSize: 60, bold: true, color: PAPER,
    isTextBox: true, margin: 0,
  })
  s.addText('One platform. Every business on it gets a real website — before paying anything.', {
    x: 1.1, y: 3.95, w: 10.4, h: 0.9,
    fontFace: BODY, fontSize: 19, color: AMBER,
    isTextBox: true, margin: 0,
  })
  s.addText('spacesangels.com', {
    x: 1.1, y: 5.1, w: 6, h: 0.4,
    fontFace: BODY, fontSize: 14, color: MUTED,
    isTextBox: true, margin: 0,
  })
  s.addNotes(
    'Hold here for a beat before you start talking.\n\n' +
      'NARRATION: This is The Angel OS. One platform, and every business running on it ' +
      'gets a real website, a real address, and a calendar that works — before they pay anything.',
  )
}

/* ── Act 1: the promise ─────────────────────────────────────────────────── */
chapter({
  eyebrow: 'Act one',
  title: 'No proposal.\nNo sales call.',
  sub: 'Most web designers want a meeting, a deposit, and three weeks.',
  notes:
    'NARRATION: Most web designers want a meeting, a deposit, and three weeks. ' +
    'This is the other version of that. You tell it your business name and what you do, ' +
    'and it builds you a real website today, and sends you the link. You look at it, and then you decide.',
})

shotSlide({
  title: "We'll build your website. Free.",
  kicker: 'spacesangels.com',
  file: '01-home-hero.png',
  notes:
    'NARRATION: There is no proposal and no sales call. It takes about a minute, and if you do not like ' +
    'what comes back, you have lost a minute and nobody will chase you.\n\n' +
    'DIRECTION: Let this breathe. Do not rush off it — the offer is the hook.',
})

shotSlide({
  title: 'These are not mockups',
  kicker: 'Every card is a live business you can click into',
  file: '02-home-showcase.png',
  notes:
    'NARRATION: And these are not mockups. Every card here is a live business, on its own address, ' +
    'that you can click into right now.\n\n' +
    'NOTE: This list only shows businesses that are genuinely customers AND have opted in to being ' +
    'listed. Portals we build speculatively for prospects never appear here, and are never indexed by Google.',
})

/* ── Act 2: what you get ────────────────────────────────────────────────── */
chapter({
  eyebrow: 'Act two',
  title: 'Four steps,\nand you can stop\nafter the first one.',
  notes:
    'NARRATION: So what actually happens? Four steps — and honestly, you can stop after the first one.',
})

shotSlide({
  title: 'How it works',
  file: '03-how-it-works.png',
  notes:
    'NARRATION: Step one, you tell us what you do — your business name, your trade, your town. ' +
    'Step two, we build it today. Not a template with your name dropped in: a real site with pages that ' +
    'suit your trade. Step three, you look at it and decide. Step four, if you want, you let it do some ' +
    'work for you — bookings, deposits, a customer list.',
})

shotSlide({
  title: 'The question everybody asks',
  kicker: 'Answered on the page, not in a sales call',
  file: '04-how-it-works-faq.png',
  notes:
    'NARRATION: The first question everybody asks is "what is the catch". So we answer it on the page. ' +
    'We build the first site free because it costs us very little and because showing you beats telling you. ' +
    'Some people upgrade for their own domain and for taking deposits. Most of what we build stays free, and that is fine.\n\n' +
    'DIRECTION: This is the trust slide. Slow down.',
})

shotSlide({
  title: 'Real sites, real businesses',
  file: '05-examples.png',
  notes:
    'NARRATION: Wedding photography. A ministry. A church. Every one of these is live, run by the person ' +
    'whose name is on it, and every one was built the same way on the same system.',
})

shotSlide({
  title: 'Tell it what you do',
  kicker: 'The whole form',
  file: '06-get-started.png',
  notes:
    'NARRATION: This is the whole form. Business name, what you do, where you do it. ' +
    'We do not ask for a card, because there is nothing to pay for yet.',
})

/* ── Act 3: a finished site ─────────────────────────────────────────────── */
chapter({
  eyebrow: 'Act three',
  title: 'What one\nactually looks like',
  sub: 'A wedding photographer in Southwest Florida.',
  notes:
    'NARRATION: Here is one that has been built out. A wedding photographer working from Fort Myers down to Miami.',
})

shotSlide({
  title: 'PayneMediaCo',
  kicker: 'paynemediaco.spacesangels.com',
  file: '07-payne-home.png',
  notes:
    'NARRATION: Photos, films, prices, contact — the whole site. His work, his words, his prices.',
})

shotSlide({
  title: 'Every wedding is its own page',
  file: '08-payne-weddings.png',
  notes:
    'NARRATION: This page is worth pausing on. Each wedding here is not a page somebody built by hand — ' +
    'it is a post, a row in the database, and it gets its own address and lists itself here automatically. ' +
    'Adding the next wedding is filling in a form. On his old site, it was building another page.',
})

shotSlide({
  title: 'One wedding, whole',
  file: '09-payne-wedding-post.png',
  notes:
    'NARRATION: Open one and it is the whole day. Its own address, its own cover, its own gallery.',
})

shotSlide({
  title: 'Forty-eight photographs',
  kicker: 'In the order the day happened',
  file: '10-payne-wedding-gallery.png',
  notes:
    'NARRATION: Forty-eight photographs, in the order the day actually happened — a wedding gallery is a ' +
    'story, and sorting it by filename would shuffle it.\n\n' +
    'PAYLOAD: Underneath, this is a blocks field. An ordered list of content blocks the owner arranges — ' +
    'gallery, video, rich text, a call to action, a form. Same blocks, any order, any page.',
})

shotSlide({
  title: 'And the film sits with it',
  file: '11-payne-film-post.png',
  notes:
    'NARRATION: And where there is a film, it lives on the same page as the photographs, instead of being ' +
    'parked on a separate videos page the way his old site had to.',
})

/* ── Act 4: bookings ────────────────────────────────────────────────────── */
chapter({
  eyebrow: 'Act four',
  title: 'And it takes\nbookings.',
  sub: 'On the free plan. Without a payment account.',
  accent: GREEN,
  notes:
    'NARRATION: Same site, still free — and it takes bookings.',
})

shotSlide({
  title: 'His services, his prices',
  file: '12-payne-book-services.png',
  notes:
    'NARRATION: These are his actual services. Only one of them carries a price, because only one of them ' +
    'has a published price — everything else says "quote", because that is what he says. ' +
    'We do not invent a number a business would have to honour or walk back.',
})

shotSlide({
  title: 'Pick a date',
  file: '17-book-pick-date.png',
  notes:
    'NARRATION: Pick a service, pick a date.\n\n' +
    'PAYLOAD: Services and availability are their own collections, so this calendar is real — ' +
    'these are his actual working hours, and the slots come from them.',
})

shotSlide({
  title: 'Pick a time',
  file: '18-book-pick-time.png',
  notes:
    'NARRATION: And the times are his times — weekends long, because a wedding photographer works when weddings happen.',
})

shotSlide({
  title: 'Request Booking',
  kicker: 'No deposit — because he has not connected a payment account',
  file: '19-book-confirm.png',
  notes:
    'NARRATION: Now look closely at the end of this. It says payment due on completion, and the button says ' +
    '"Request Booking".\n\n' +
    'He has not connected a payment account — so the platform does not pretend it can charge a card. ' +
    'The booking arrives as a request, and nobody is charged a penny.\n\n' +
    'The moment he connects Stripe, that same button becomes a deposit. No rebuild, no migration, no new plan. ' +
    'One setting.\n\n' +
    'DIRECTION: This is the strongest slide in the deck. Land it and pause.',
})

/* ── Act 5: one engine ──────────────────────────────────────────────────── */
chapter({
  eyebrow: 'Act five',
  title: 'The same engine,\na different face',
  notes:
    'NARRATION: Now — a photographer needs almost nothing a church needs. So how many products is this?',
})

shotSlide({
  title: 'A church',
  kicker: 'grace-chapel.spacesangels.com',
  file: '13-grace-chapel.png',
  notes:
    'NARRATION: Here is a church. Different everything — different pages, different language, different purpose.',
})

shotSlide({
  title: 'A ministry that also sells and schedules',
  kicker: "clearwater-cruisin.spacesangels.com",
  file: '14-clearwater.png',
  notes:
    'NARRATION: And here is a ministry with twenty-one articles, a shop and a booking calendar on one site. ' +
    'The case for one place doing writing, selling and scheduling, instead of three services that do not talk to each other.\n\n' +
    'Nothing was forked to make any of these. Same collections, same blocks, same deployment. ' +
    'That is the difference between a platform and a template.',
})

/* ── Act 6: under the hood ──────────────────────────────────────────────── */
chapter({
  eyebrow: 'Act six',
  title: 'One system\nunderneath',
  sub: 'Built on Payload CMS.',
  notes:
    'NARRATION: Which brings me to the part I actually want to talk about.',
})

shotSlide({
  title: 'One platform, many portals',
  file: '15-learn-platform.png',
  notes:
    'NARRATION: This is not a builder that stamps out a copy of a template for every customer. ' +
    'It is one Payload CMS instance — one deployment, one Postgres database — and every business on it is a tenant.\n\n' +
    'PAYLOAD: Payload\'s multi-tenant plugin scopes every collection by tenant, so a page, a post, a product, ' +
    'a booking, an image — each belongs to exactly one portal, and every query says so. Nobody can see ' +
    'anyone else\'s anything.\n\n' +
    'The payoff is that a fix lands once and every portal has it that day. There is no fleet of WordPress ' +
    'sites drifting apart, each with its own plugin versions and its own security problem waiting to happen.\n\n' +
    'And I should say the quiet part out loud: none of this is my CMS. It is Payload, and it is the best ' +
    'content management system anyone has built so far. Collections, fields, hooks and access control are ' +
    'defined in TypeScript, and the admin panel is generated from that schema — so there is no second model ' +
    'to keep in sync, and no plugin marketplace to trust.',
})

shotSlide({
  title: 'What the assistant is told first',
  file: '16-learn-seed-prompt.png',
  notes:
    'NARRATION: One last thing, and it is small.\n\n' +
    'Every request the assistant makes on your behalf opens with the same instruction, before your ' +
    'question and before any action it takes. "A lamp unto feet — through darkness, a steady light guides ' +
    'each step with care." Alongside it: dignity, transparency, service, non-harm, accountability.\n\n' +
    'That is not a marketing line. It is the actual first text in the actual prompt, it is written into the ' +
    'terms of service, and there is an automated test that fails if anyone removes it.\n\n' +
    'Something acting on your behalf should be carrying an instruction to be kind while it does.',
})

/* ── Close ──────────────────────────────────────────────────────────────── */
{
  const s = pres.addSlide()
  s.background = { color: INK }
  s.addText('Tell it what you do.', {
    x: 1.1, y: 2.7, w: 11, h: 1.1,
    fontFace: HEAD, fontSize: 48, bold: true, color: PAPER,
    isTextBox: true, margin: 0,
  })
  s.addText('Look at what comes back.', {
    x: 1.1, y: 3.85, w: 11, h: 1.1,
    fontFace: HEAD, fontSize: 48, bold: true, color: AMBER,
    isTextBox: true, margin: 0,
  })
  s.addText('spacesangels.com', {
    x: 1.1, y: 5.3, w: 6, h: 0.4,
    fontFace: BODY, fontSize: 15, color: MUTED,
    isTextBox: true, margin: 0,
  })
  s.addNotes(
    'NARRATION (long cut): One platform. Every business on it gets a real site, a real address, and a ' +
      'calendar that works — before paying anything. Tell it what you do, and look at what comes back.\n\n' +
      'NARRATION (short cut, use this instead): No proposal, no sales call. Tell it your business name and ' +
      'what you do, and look at what comes back. If you do not like it, you have lost a minute and nobody ' +
      'will chase you.',
  )
}

await pres.writeFile({ fileName: OUT })
console.log('Wrote', OUT)
