/** One-off: add the A/C symptom to the van post (67) — rebuilds the content block, keeps the gallery. */
import { getPayload } from 'payload'
import config from '@payload-config'

const POST = 67

const BODY = `Vehicle: Chevy conversion van — 5.7L 350 Vortec V8 (S1500 chassis).

WHAT'S HAPPENING
The van refused to start for roughly three days about two weeks ago, then mysteriously self-healed and has been starting since. Current behavior:

- Slow start: once cranking, it takes 1–3 seconds to catch — sometimes longer depending on how long it sat.
- Priming helps a lot: turning the key to ON and letting the fuel pump prime for a second or two before cranking noticeably improves starts (only recently discovered this).
- Occasional overnight battery drain: the battery has mysteriously drained overnight with all interior lights etc. off. Has NOT happened recently.
- A/C split front/rear: ice cold in the BACK, tepid at best up front — and it only gets there after driving ~5 miles at >35 mph. Both zones run off the front compressor.

HISTORY
- Fuel pump and several other fuel system components were replaced in 2022 — receipts available.
- Oil recently topped off. Some leaks present, but transmission fluid and oil levels are more than satisfactory.

SUSPICIONS / QUESTIONS FOR VLAD
- Fuel pressure bleeding down while parked (check valve / regulator / injector leak-down)?
- Parasitic draw behind the intermittent overnight battery drain?
- A/C: low charge or front expansion-valve/blend-door issue? (Rear getting cold while front stays tepid, both on one compressor.)

Photos of the van below. Text Kenneth to arrange a look.`

function textToLexical(text: string): any {
  const paragraphs = text.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)
  const children = paragraphs.map((block) => ({
    type: 'paragraph',
    children: [{ type: 'text', text: block, detail: 0, format: 0, mode: 'normal', style: '', version: 1 }],
    direction: 'ltr', format: '', indent: 0, version: 1,
  }))
  return { root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 } }
}

const payload = await getPayload({ config })
const post = (await payload.findByID({ collection: 'posts', id: POST, depth: 0, overrideAccess: true })) as any
const layout: any[] = (post.layout || []).map((b: any) =>
  b.blockType === 'content' ? { ...b, columns: [{ ...(b.columns?.[0] || { size: 'full' }), richText: textToLexical(BODY) }] } : b,
)
await (payload.update as any)({ collection: 'posts', id: POST, data: { layout }, overrideAccess: true })
console.log('OK — AC symptom added to post', POST)
process.exit(0)
