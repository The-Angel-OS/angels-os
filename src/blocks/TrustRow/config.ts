import type { Block } from 'payload'

/**
 * TrustRow — the badge strip that makes a stranger comfortable spending $599.
 *
 * A $99 belt and a $599 one look identical in a search result. What separates
 * them on the page is not adjectives, it's the small print made large: who
 * registered it, who backs it, how long you have to change your mind.
 *
 * Icon is a SELECT, not an upload, so a tenant gets a usable row without
 * sourcing artwork — and the glyphs are drawn from `var(--tenant-primary)`, so
 * the same block on Clearwater comes out Clearwater's colour. Parameterise on
 * branding; don't fork per client.
 */
export const TrustRow: Block = {
  slug: 'trustRow',
  interfaceName: 'TrustRowBlock',
  fields: [
    {
      name: 'heading',
      type: 'text',
      admin: { description: 'Optional. Most trust rows read better with no heading at all.' },
    },
    {
      name: 'items',
      type: 'array',
      minRows: 2,
      maxRows: 6,
      admin: { description: 'Four is the number that reads as a row rather than a list.' },
      fields: [
        {
          name: 'icon',
          type: 'select',
          required: true,
          defaultValue: 'shield',
          options: [
            { label: 'Shield — registered / certified', value: 'shield' },
            { label: 'Rosette — warranty / guarantee', value: 'rosette' },
            { label: 'Arrow round — returns / money back', value: 'return' },
            { label: 'Truck — shipping', value: 'truck' },
            { label: 'Lock — secure payment', value: 'lock' },
            { label: 'Headset — support', value: 'support' },
            { label: 'Star — rating / reputation', value: 'star' },
          ],
        },
        { name: 'label', type: 'text', required: true, admin: { description: 'Two or three words. "FDA Registered".' } },
        { name: 'detail', type: 'text', admin: { description: 'One short line. Not a sentence.' } },
      ],
    },
    {
      name: 'footnote',
      type: 'text',
      admin: {
        description:
          'Small print under the row. Use it for the qualifier a claim needs — e.g. that registered is not the same as cleared.',
      },
    },
  ],
  labels: { plural: 'Trust Rows', singular: 'Trust Row' },
}
