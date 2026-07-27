import type { Field } from 'payload'

import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { linkGroup } from './linkGroup'

export const hero: Field = {
  name: 'hero',
  type: 'group',
  fields: [
    {
      name: 'type',
      type: 'select',
      defaultValue: 'lowImpact',
      label: 'Type',
      options: [
        {
          label: 'None',
          value: 'none',
        },
        {
          label: 'Full Screen (full-bleed background image + overlaid headline)',
          value: 'fullScreen',
        },
        {
          // Same single full-bleed image as fullScreen — the difference is the
          // content sits LEFT over a dark gradient instead of centred, which is
          // the corporate product-page look. No second asset needed.
          label: 'Split Panel (image with content on the left)',
          value: 'splitPanel',
        },
        {
          label: 'High Impact',
          value: 'highImpact',
        },
        {
          label: 'Medium Impact',
          value: 'mediumImpact',
        },
        {
          label: 'Low Impact',
          value: 'lowImpact',
        },
      ],
      required: true,
    },
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
      label: false,
    },
    linkGroup({
      overrides: {
        maxRows: 2,
      },
    }),
    {
      name: 'media',
      type: 'upload',
      admin: {
        condition: (_, { type } = {}) => ['fullScreen', 'splitPanel', 'highImpact', 'mediumImpact'].includes(type),
      },
      relationTo: 'media',
      required: true,
    },
    {
      name: 'mediaFit',
      type: 'select',
      // Defaults to current behavior (cover) so existing heroes are unchanged.
      defaultValue: 'cover',
      label: 'Image Fit',
      options: [
        { label: 'Cover — fill the box, crop overflow (default)', value: 'cover' },
        { label: 'Contain — show the whole image, letterboxed', value: 'contain' },
        { label: 'Fill — stretch to the box edges', value: 'fill' },
      ],
      admin: {
        // Only High Impact has a fixed-height box where object-fit changes anything.
        condition: (_, { type } = {}) => type === 'highImpact',
        description: 'How the hero image fills its frame. Fill is best for pre-cropped banners.',
      },
    },
  ],
  label: false,
}
