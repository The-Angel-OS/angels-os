import type { Block } from 'payload'

/**
 * Showcase — image cards on a gradient band.
 *
 * The single most recognisable section of kessela.com: three photographs of the
 * product in use, captioned, sitting on a blue-through-magenta gradient. Ours
 * rendered those captions as plain paragraphs on a flat background, which is
 * most of why the mirror looked like a document beside their site.
 *
 * Parameterised, not forked. `brand` derives the whole band from
 * `--tenant-primary`, so the same block on Clearwater comes out Clearwater's
 * colour with nothing to configure — the rule Ken set, and the same one the
 * trust row follows.
 */
export const Showcase: Block = {
  slug: 'showcase',
  interfaceName: 'ShowcaseBlock',
  fields: [
    { name: 'heading', type: 'text', admin: { description: 'Optional title above the cards.' } },
    {
      name: 'items',
      type: 'array',
      minRows: 2,
      maxRows: 4,
      admin: { description: 'Three is the number their design uses and the number that reads as a row.' },
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'caption', type: 'text', required: true, admin: { description: 'Three or four words over the image.' } },
        { name: 'url', type: 'text', admin: { description: 'Optional — makes the whole card a link.' } },
      ],
    },
    {
      name: 'statement',
      type: 'textarea',
      admin: {
        description:
          'Large centred sentence under the cards, on the gradient. The one line someone remembers.',
      },
    },
    {
      name: 'background',
      type: 'select',
      defaultValue: 'brand',
      options: [
        { label: 'Brand gradient (from the portal colour)', value: 'brand' },
        { label: 'Aurora — blue → violet → magenta → red', value: 'aurora' },
        { label: 'Dark', value: 'dark' },
        { label: 'None', value: 'none' },
      ],
      admin: { description: 'Brand is the default so a new portal looks like itself, not like Kessela.' },
    },
  ],
  labels: { plural: 'Showcases', singular: 'Showcase' },
}
