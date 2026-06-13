import type { CollectionConfig } from 'payload'

import { Banner } from '@/blocks/Banner/config'
import { Carousel } from '@/blocks/Carousel/config'
import { ThreeItemGrid } from '@/blocks/ThreeItemGrid/config'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { adminOnly } from '@/access/adminOnly'
import { Archive } from '@/blocks/ArchiveBlock/config'
import { CallToAction } from '@/blocks/CallToAction/config'
import { Content } from '@/blocks/Content/config'
import { FormBlock } from '@/blocks/Form/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { Calendar } from '@/blocks/Calendar/config'
import { Donation } from '@/blocks/Donation/config'
import { FeaturedEndeavors } from '@/blocks/FeaturedEndeavors/config'
import { hero } from '@/fields/hero'
import { simpleSlugField } from '@/fields/simpleSlugField'
import { adminOrPublishedWithTenantScope } from '@/access/adminOrPublishedWithTenantScope'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import { revalidatePage, revalidateDelete } from './hooks/revalidatePage'

export const Pages: CollectionConfig = {
  slug: 'pages',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOrPublishedWithTenantScope,
    update: adminOnly,
  },
  admin: {
    group: 'Content',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'pages',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'pages',
        req,
      }),
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'publishedOn',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            if (siblingData._status === 'published' && !value) {
              return new Date()
            }
            return value
          },
        ],
      },
    },
    // ─── Navigation control ───────────────────────────────────────────────
    // A published page is auto-listed in the Home menu UNLESS showInNav is off
    // (e.g. a lead-capture / campaign landing page that should stay out of nav).
    // navOrder sorts the menu; navLabel overrides the menu text; parent (from the
    // nested-docs plugin) nests one level deep. See injectPagesUnderHome.
    {
      name: 'showInNav',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Show this page in the site navigation (Home menu). Turn off for campaign/landing pages.',
      },
    },
    {
      name: 'navLabel',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Optional menu label (defaults to the page title).',
        condition: (data) => data?.showInNav !== false,
      },
    },
    {
      name: 'navOrder',
      type: 'number',
      admin: {
        position: 'sidebar',
        description: 'Sort order in the menu (lower first; blank sorts last, then by title).',
        condition: (data) => data?.showInNav !== false,
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [hero],
          label: 'Hero',
        },
        {
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              blocks: [
                CallToAction,
                Content,
                MediaBlock,
                Archive,
                Carousel,
                ThreeItemGrid,
                Banner,
                FormBlock,
                Calendar,
                Donation,
                FeaturedEndeavors,
              ],
              required: true,
            },
          ],
          label: 'Content',
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: 'media',
            }),

            MetaDescriptionField({}),
            PreviewField({
              // if the `generateUrl` function is configured
              hasGenerateFn: true,

              // field paths to match the target field for data
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    simpleSlugField,
  ],
  hooks: {
    afterChange: [revalidatePage],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: true,
    },
    maxPerDoc: 50,
  },
}
