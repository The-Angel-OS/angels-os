import type { Block } from 'payload'

import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

export const Donation: Block = {
  slug: 'donation',
  interfaceName: 'DonationBlock',
  fields: [
    {
      name: 'richText',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [
            ...rootFeatures,
            HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
            FixedToolbarFeature(),
            InlineToolbarFeature(),
          ]
        },
      }),
      label: 'Description',
    },
    {
      name: 'presetAmounts',
      type: 'text',
      defaultValue: '5,10,25,50,100',
      admin: {
        description: 'Comma-separated dollar amounts for quick-select buttons (e.g. "5,10,25,50,100")',
      },
    },
    {
      name: 'showDonorFields',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Show optional name/email/message fields',
      },
    },
  ],
  labels: {
    plural: 'Donation Forms',
    singular: 'Donation Form',
  },
}
