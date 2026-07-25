/**
 * One-off: the van diagnostic post on the Start-S (tenant 24) portal, so Vlad
 * can read the full history when he OTPs in. No media yet — Ken will add a
 * gallery via LEO as he uploads photos through the chat control.
 * Run in container: node_modules/.bin/payload run src/scripts/_local/create-van-post.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const TENANT = 24

const BODY = `Vehicle: Chevy conversion van — 5.7L 350 Vortec V8 (S1500 chassis).

WHAT'S HAPPENING
The van refused to start for roughly three days about two weeks ago, then mysteriously self-healed and has been starting since. Current behavior:

- Slow start: once cranking, it takes 1–3 seconds to catch — sometimes longer depending on how long it sat.
- Priming helps a lot: turning the key to ON and letting the fuel pump prime for a second or two before cranking noticeably improves starts (only recently discovered this).
- Occasional overnight battery drain: the battery has mysteriously drained overnight with all interior lights etc. off. Has NOT happened recently.

HISTORY
- Fuel pump and several other fuel system components were replaced in 2022 — receipts available.
- Oil recently topped off. Some leaks present, but transmission fluid and oil levels are more than satisfactory.

SUSPICIONS / QUESTIONS FOR VLAD
- Fuel pressure bleeding down while parked (check valve / regulator / injector leak-down)?
- Parasitic draw behind the intermittent overnight battery drain?

Photos of the van and the 2022 receipts to follow in the gallery below. Text Kenneth to arrange a look.`

function textToLexical(text: string): any {
  const paragraphs = text.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)
  const children = paragraphs.map((block) => ({
    type: 'paragraph',
    children: [{ type: 'text', text: block, detail: 0, format: 0, mode: 'normal', style: '', version: 1 }],
    direction: 'ltr', format: '', indent: 0, version: 1,
  }))
  return { root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 } }
}

// top-level await — payload run doesn't wait for a floating main() promise
const payload = await getPayload({ config })
{
  const existing = await payload.find({
    collection: 'posts',
    where: { and: [{ tenant: { equals: TENANT } }, { title: { like: 'Conversion Van' } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })
  if (existing.docs.length) {
    console.log('EXISTS post id=' + existing.docs[0].id)
    process.exit(0)
  }
  const result = await (payload.create as any)({
    collection: 'posts',
    data: {
      title: 'Conversion Van — Hard Start / No-Start History (350 Vortec V8)',
      _status: 'published',
      tenant: TENANT,
      layout: [{ blockType: 'content', columns: [{ size: 'full', richText: textToLexical(BODY) }] }],
    },
    overrideAccess: true,
  })
  console.log(`OK post id=${result.id} slug=${result.slug} status=${result._status} tenant=${TENANT}`)
  process.exit(0)
}
