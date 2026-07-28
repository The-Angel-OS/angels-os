import type { Block } from 'payload'

/**
 * FAQ — an accordion of questions, and the structured data that goes with it.
 *
 * This is a conversion block, not a support block. "Will it fit my waist?" and
 * "Is it safe?" are the two questions between a stranger and a $599 purchase,
 * and answering them on the page is cheaper than answering them on the phone.
 *
 * It also emits FAQPage JSON-LD, which is how these end up as expandable
 * questions directly in Google results — free surface area for a product
 * nobody is searching for by name yet.
 */
export const Faq: Block = {
  slug: 'faq',
  interfaceName: 'FaqBlock',
  fields: [
    { name: 'heading', type: 'text', defaultValue: 'Frequently Asked Questions' },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      fields: [
        { name: 'question', type: 'text', required: true },
        {
          name: 'answer',
          type: 'textarea',
          required: true,
          admin: { description: 'Plain text. Blank lines become paragraphs.' },
        },
      ],
    },
    {
      name: 'openFirst',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'Show the first answer expanded. A wall of closed rows reads as a menu; one open answer shows there is something worth opening.',
      },
    },
  ],
  labels: { plural: 'FAQs', singular: 'FAQ' },
}
