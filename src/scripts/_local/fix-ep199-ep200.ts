import { getPayload } from 'payload'
import config from '@payload-config'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
} from '@/utilities/lexicalHelpers'

const payload = await getPayload({ config })
const tenantId = 45

console.log('[Fix] Updating EP 200 and EP 199 on tenant #45...')

// 1. EP 200: J200: Welcome to the Old World
// It is the celebratory 200th episode milestone reflecting on the 1.1M audience, 200 investigations, and Old World discoveries.
const ep200Post = await payload.find({
  collection: 'posts',
  where: { and: [{ slug: { equals: 'ep-200' } }, { tenant: { equals: tenantId } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})

if (ep200Post.docs[0]) {
  const contentNodes = [
    createHeadingNode('EP 200 — J200: Welcome to the Old World', 'h2'),
    createParagraphNode(
      'My Lunch Break Investigation Episode #200 · Watch on YouTube: https://www.youtube.com/watch?v=nBSqPxRjzzQ',
    ),
    createHeadingNode('200 Episodes of Old World Discoveries', 'h3'),
    createParagraphNode(
      'On January 31, 2023, I sat in my car during my lunch break and recorded the very first episode of My Lunch Break. What started as a simple curiosity about the incredible architecture of the Old World has become a journey shared by over 1.1 million people around the world. 200 Episodes later, the questions have only grown, the discoveries have become more extraordinary, and the mysteries continue to unfold. Today, we celebrate everything we’ve uncovered, the community we’ve built, and the incredible journey still ahead of us.',
    ),
    createParagraphNode(
      'Welcome to Episode 200. Welcome to the Old World.',
    ),
  ]

  await payload.update({
    collection: 'posts',
    id: ep200Post.docs[0].id,
    data: {
      title: 'EP 200 — J200: Welcome to the Old World',
      layout: [
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: createLexicalContent(contentNodes),
            },
          ],
        },
        {
          blockType: 'comments',
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    overrideAccess: true,
  })
  console.log('[Fix] Successfully updated EP 200 cleanly without synthetic structures!')
}

// 2. EP 199: The GREAT RESET Already Happened
// Paris 1900 Exposition Universelle investigation
const ep199Post = await payload.find({
  collection: 'posts',
  where: { and: [{ slug: { equals: 'ep-199' } }, { tenant: { equals: tenantId } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})

if (ep199Post.docs[0]) {
  const contentNodes = [
    createHeadingNode('EP 199 — The GREAT RESET Already Happened (Paris 1900)', 'h2'),
    createParagraphNode(
      'My Lunch Break Investigation Episode #199 · Watch on YouTube: https://www.youtube.com/watch?v=DPY9Sgat6Qc',
    ),
    createHeadingNode('The Paris 1900 Exposition Universelle Investigation', 'h3'),
    createParagraphNode(
      'In 1900, Paris became home to one of the most extraordinary architectural displays the world had ever seen. Enormous palaces, breathtaking craftsmanship, and structures so magnificent they almost seem impossible by today’s standards. But what happened next is even more fascinating. More than a century later, the surviving photographs reveal details that raise some very uncomfortable questions about the history we’ve been taught. How was all of this possible? And why has so much of it vanished?',
    ),
    createHeadingNode('Structures Investigated in Episode #199 (3)', 'h3'),
    createHeadingNode('Grand Palais (Paris, France)', 'h4'),
    createParagraphNode(
      'Monumental Beaux-Arts exhibition hall built with an enormous glass barrel-vaulted roof, iron framing, and stone colonnades on the Champs-Élysées. Investigated for its purported 3-year construction timeline and intricate structural ironwork.',
    ),
    createHeadingNode('Petit Palais (Paris, France)', 'h4'),
    createParagraphNode(
      'Classical palace directly opposite the Grand Palais featuring an elaborate trapezoidal courtyard, monumental arched entrance, and ornate stone sculptural reliefs.',
    ),
    createHeadingNode('Palace of Electricity (Palais de l’Électricité) (Paris, France)', 'h4'),
    createParagraphNode(
      'Towering Old World power and lighting pavilion at the Champ de Mars, allegedly erected solely as a temporary exhibition facade and powered by massive dynamos in subterranean basements.',
    ),
  ]

  await payload.update({
    collection: 'posts',
    id: ep199Post.docs[0].id,
    data: {
      title: 'EP 199 — The GREAT RESET Already Happened (Paris 1900)',
      layout: [
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: createLexicalContent(contentNodes),
            },
          ],
        },
        {
          blockType: 'comments',
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    overrideAccess: true,
  })
  console.log('[Fix] Successfully updated EP 199 with authentic Paris 1900 investigation dossier!')
}

process.exit(0)
