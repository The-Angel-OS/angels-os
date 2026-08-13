/**
 * The two topic pages end in a "FAQs" heading over a wall of paragraphs. Same
 * questions, same answers — just not in the block that renders an accordion and
 * emits FAQPage JSON-LD, which is how these surface as expandable results in
 * Google. Home and /buy-kessela-now already have it; these two were missed.
 *
 * Also drops the stray one-line "Scientifically proven" / "To burn fat" blocks
 * that trail both pages — leftovers of the same footer-as-content import the
 * badge sweep cleaned up, with no body under them.
 *
 * Copy is theirs. On /electrical-muscle-stimulation the question and its answer
 * ran together in one paragraph; splitting them at the question mark is the only
 * edit, and it changes no words.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-topic-faqs.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { updatePageLayout, type LayoutBlock } from './_updatePageLayout'

const payload = await getPayload({ config })

const tenants = await payload.find({
  collection: 'tenants', where: { slug: { equals: 'kessela' } }, limit: 1, depth: 0, overrideAccess: true,
})
const tenantId = (tenants.docs?.[0] as { id: number } | undefined)?.id
if (!tenantId) throw new Error('No kessela tenant.')

type QA = { question: string; answer: string }

const FAQS: Record<string, QA[]> = {
  'electrical-muscle-stimulation': [
    {
      question: 'Is EMS safe to use?',
      answer:
        'Yes, EMS is generally safe when used according to the manufacturer’s instructions. However, it is important to follow safety guidelines and consult with a healthcare professional if you have any underlying medical conditions.',
    },
    {
      question: 'How often should I use EMS?',
      answer:
        'The frequency of EMS sessions depends on your goals. For muscle strengthening, sessions can be done several times a week. For pain relief and rehabilitation, shorter, more frequent sessions may be recommended.',
    },
    {
      question: 'Can EMS help with weight loss?',
      answer:
        'While EMS can help to tone and strengthen muscles, it is not a weight loss tool. Combining EMS with a healthy diet and regular exercise can enhance overall fitness and body composition.',
    },
    {
      question: 'Where should I place the electrodes?',
      answer:
        'Proper electrode placement is crucial for effective EMS treatment. Follow the device’s instructions or consult with a professional to ensure correct placement.',
    },
    {
      question: 'Can I use EMS if I have a pacemaker?',
      answer:
        'No, EMS should not be used if you have a pacemaker or other implanted electrical devices, as it may interfere with their function. Always consult with a healthcare professional before using EMS.',
    },
  ],
  'red-near-infrared-light': [
    {
      question: 'Is red and near-infrared light therapy safe?',
      answer:
        'Yes, PBM is generally considered safe with minimal side effects. However, it’s important to follow the manufacturer’s guidelines and consult with a healthcare provider if you have any medical conditions.',
    },
    {
      question: 'How often should I use PBM therapy?',
      answer:
        'For best results, it’s recommended to use PBM therapy several times a week. The duration and frequency of treatments can vary based on individual needs and the specific device used.',
    },
    {
      question: 'Can PBM help with weight loss?',
      answer:
        'Yes, PBM can aid in weight loss by reducing the size of fat cells and decreasing appetite-regulating hormones. It is most effective when combined with a healthy diet and regular exercise.',
    },
    {
      question: 'What should I look for in a PBM device?',
      answer:
        'Choose a PBM device that uses advanced SMD technology, delivers light at the proper wavelengths, and has positive reviews and clinical backing.',
    },
    {
      question: 'Can I use PBM therapy at home?',
      answer:
        'Yes, many PBM devices are designed for home use. Ensure you follow the instructions and safety guidelines provided by the manufacturer.',
    },
  ],
}

/** One-line leftovers with nothing under them. */
const STRAYS = ['Scientifically proven', 'To burn fat']

const firstText = (block: LayoutBlock): string => {
  let found = ''
  const walk = (x: unknown): void => {
    if (found || !x) return
    if (Array.isArray(x)) return x.forEach(walk)
    if (typeof x !== 'object') return
    const o = x as Record<string, unknown>
    if (o.type === 'heading' || o.type === 'paragraph') {
      const s = ((o.children as Array<{ text?: string }>) ?? []).map((c) => c?.text ?? '').join('').trim()
      if (s) {
        found = s
        return
      }
    }
    Object.values(o).forEach(walk)
  }
  walk(block)
  return found
}

/** Count paragraphs so a one-line stray can be told from a real section. */
const paraCount = (block: LayoutBlock): number => {
  let n = 0
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) return x.forEach(walk)
    if (!x || typeof x !== 'object') return
    const o = x as Record<string, unknown>
    if (o.type === 'heading' || o.type === 'paragraph') {
      const s = ((o.children as Array<{ text?: string }>) ?? []).map((c) => c?.text ?? '').join('').trim()
      if (s) n++
    }
    Object.values(o).forEach(walk)
  }
  walk(block)
  return n
}

for (const [slug, items] of Object.entries(FAQS)) {
  const res = await payload.find({
    collection: 'pages',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })
  const page = res.docs?.[0] as unknown as
    | { id: number; slug: string; _status?: string | null; layout?: LayoutBlock[] }
    | undefined
  if (!page) {
    console.warn(`no page /${slug}`)
    continue
  }

  const layout = page.layout ?? []
  const next: LayoutBlock[] = []
  for (const block of layout) {
    const type = (block as { blockType?: string }).blockType
    if (type !== 'content') {
      next.push(block)
      continue
    }
    const head = firstText(block)
    if (head === 'FAQs') {
      next.push({ blockType: 'faq', heading: 'Frequently Asked Questions', openFirst: true, items })
      continue
    }
    if (paraCount(block) === 1 && STRAYS.includes(head)) continue
    next.push(block)
  }

  await updatePageLayout(payload, page, next)
  console.log(`${slug}: ${layout.length} → ${next.length} (faq block, ${items.length} questions)`)
}
