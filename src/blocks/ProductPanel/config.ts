import type { Block } from 'payload'

import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

/**
 * ProductPanel — gallery with a lightbox, beside formatted copy.
 *
 * Kessela's buy page in one block: a large product shot with a thumbnail strip
 * under it, and the description beside it with its own bolding. Our version had
 * the same words as an undifferentiated paragraph, which is why theirs reads as
 * a product listing and ours read as prose.
 *
 * `body` is richText specifically so the emphasis is the owner's to control —
 * matching someone's typography is not a code change, it is a field.
 */
export const ProductPanel: Block = {
  slug: 'productPanel',
  interfaceName: 'ProductPanelBlock',
  fields: [
    {
      name: 'images',
      type: 'array',
      minRows: 1,
      maxRows: 8,
      admin: { description: 'First is the one shown. The rest become thumbnails.' },
      fields: [{ name: 'image', type: 'upload', relationTo: 'media', required: true }],
    },
    { name: 'heading', type: 'text', required: true },
    {
      name: 'price',
      type: 'text',
      admin: { description: 'Shown as written — e.g. "PRICE: $599.00". Free text so it can match theirs exactly.' },
    },
    {
      name: 'body',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => [
          ...rootFeatures,
          HeadingFeature({ enabledHeadingSizes: ['h3', 'h4'] }),
          FixedToolbarFeature(),
          InlineToolbarFeature(),
        ],
      }),
      admin: { description: 'Bold what they bold. This is where the typography match happens.' },
    },
    { name: 'ctaLabel', type: 'text', defaultValue: 'Buy now' },
    { name: 'ctaUrl', type: 'text', admin: { description: 'Usually the product page.' } },
    {
      name: 'footnote',
      type: 'text',
      admin: { description: 'Small line under the button — financing, shipping, guarantee.' },
    },
  ],
  labels: { plural: 'Product Panels', singular: 'Product Panel' },
}
