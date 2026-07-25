/**
 * One-off: create the Cadillac CTS sale post that LEO reported creating but never
 * persisted (media 388-391 uploaded to tenant 5, no post row). Uses the real
 * Payload create flow — same data shape as createPostFromMedia. Draft, not published.
 * Run inside the container: npx tsx src/scripts/_local/create-cadillac-post.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const TENANT = 5
const MEDIA = [388, 389, 390, 391] // hero = first
const HERO = MEDIA[0]

const BODY = `If you want a luxury sport sedan that feels special every time you drive it, this is the one. Selling my 2010 Cadillac CTS Performance AWD with the silky-smooth 3.0L LF1 direct-injection V6 (270 hp) and the Bose premium audio system that turns every drive into a rolling concert.

This CTS has been a featured cruiser on our Clearwater Cruisin' channel — countless scenic drives filmed around Clearwater, Dunedin, and the Gulf coast. It's been my rolling Walkman, and it never fails to make you smile. 500 Watt Kicker 12" Powered Sub included ($500.00 value).

WHY YOU'LL LOVE IT
- Performance Trim + AWD — handles like it's on rails
- Bose Premium Audio with SiriusXM — factory system, no upgrades needed
- 3.0L DI V6 + 6-Speed Auto — smooth, efficient, ~31 mpg highway
- Heated Leather Seats
- Dual-Zone Climate Control
- Power Sunroof with retractable shade
- Factory 18" Wheels
- Clean Title, No Accidents

RECENT MAINTENANCE
- New battery (~$250)
- Power steering service @ Dimmitt Cadillac (~$950)
- Nearly new Continental tires — smooth & quiet
- Radiator fan replaced
- A/C drain & flush — blows ice cold
- Front & rear brakes recently replaced
- Fresh oil change — less than 100 miles ago

CONDITION
Runs and drives beautifully. Everything works.

UPGRADES & NOTES
- Both headlamps recently replaced
- Headlamp housings polished and refurbished to a clean xenon-white output
- Factory adaptive/steering headlamps — beams track with the wheel for safer night driving
- Manual front door lock operation
- Armrest trim needs re-glued
- Upholstery has various rips/tears

Vehicle: 2010 Cadillac CTS Sedan 4D — VIN 1G6DL5EG6A0113323

Car is the Star of our YouTube channel: Clearwater Cruisin' — https://www.youtube.com/@clearwatercruisin

SEE IT / BUY IT
Cash only. Test drives with valid license + proof of funds.`

function textToLexical(text: string): any {
  const paragraphs = text.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)
  const children = paragraphs.map((block) => ({
    type: 'paragraph',
    children: [{ type: 'text', text: block, detail: 0, format: 0, mode: 'normal', style: '', version: 1 }],
    direction: 'ltr', format: '', indent: 0, version: 1,
  }))
  return { root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 } }
}

async function main() {
  const payload = await getPayload({ config })
  const layout: any[] = [
    { blockType: 'content', columns: [{ size: 'full', richText: textToLexical(BODY) }] },
    { blockType: 'gallery', columns: '3', images: MEDIA.map((id) => ({ image: id })) },
  ]
  const result = await (payload.create as any)({
    collection: 'posts',
    data: {
      title: "For Sale: 2010 Cadillac CTS Performance AWD — Star of Clearwater Cruisin'",
      _status: 'draft',
      tenant: TENANT,
      layout,
      hero: { type: 'highImpact', media: HERO },
      meta: { image: HERO },
    },
    overrideAccess: true,
  })
  console.log(`OK post id=${result.id} slug=${result.slug} status=${result._status} tenant=${TENANT}`)
  process.exit(0)
}

main().catch((e) => { console.error('FAILED', e); process.exit(1) })
