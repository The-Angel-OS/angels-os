import type { CollectionConfig } from 'payload'

import { Banner } from '@/blocks/Banner/config'
import { Carousel } from '@/blocks/Carousel/config'
import { ThreeItemGrid } from '@/blocks/ThreeItemGrid/config'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { adminOnly } from '@/access/adminOnly'
import { adminOrPortalManager, adminOrPortalManagerCreate } from '@/access/portalManager'
import { enforceManagedTenant, enforceManagedTenantOnChange } from '@/hooks/enforceManagedTenant'
import { Archive } from '@/blocks/ArchiveBlock/config'
import { CallToAction } from '@/blocks/CallToAction/config'
import { Content } from '@/blocks/Content/config'
import { Gallery } from '@/blocks/Gallery/config'
import { Comments } from '@/blocks/Comments/config'
import { FormBlock } from '@/blocks/Form/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { Calendar } from '@/blocks/Calendar/config'
import { GoogleReviews } from '@/blocks/GoogleReviews/config'
import { MediaText } from '@/blocks/MediaText/config'
import { hero } from '@/fields/hero'
import { Video } from '@/blocks/Video/config'
import { simpleSlugField } from '@/fields/simpleSlugField'
import { adminOrPublishedWithTenantScope } from '@/access/adminOrPublishedWithTenantScope'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import { revalidateDelete, revalidatePost } from './hooks/revalidatePost'
import { fillMetaFromContent } from './hooks/fillMetaFromContent'
import { PAGE_ACCESS_OPTIONS } from '@/utilities/pageAccess'

export const Posts: CollectionConfig = {
  slug: 'posts',
  // Document locking off (Answer 53) — see Pages/index.ts: avoids the fragile
  // payload_locked_documents lock query that breaks admin saves on the angels node.
  lockDocuments: false,
  access: {
    // A portal's own tenant_admin may run their own blog. Scoped by ROLE, not by
    // tenant membership — see access/portalManager.ts for why that distinction
    // is the whole ballgame. Read is unchanged: it is already public/published.
    create: adminOrPortalManagerCreate,
    delete: adminOrPortalManager,
    read: adminOrPublishedWithTenantScope,
    update: adminOrPortalManager,
  },
  admin: {
    group: 'Content',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    listSearchableFields: ['title', 'slug', 'sourceUrl'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'posts',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'posts',
        req,
      }),
    useAsTitle: 'title',
    description: 'Blog posts and articles with rich content and categorization',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    // Who may READ the body. Same ladder as Pages.access — one vocabulary, so a
    // "members in good standing" post and page mean the same thing. The archive
    // card (title/excerpt/image) stays public on purpose: that IS the teaser.
    {
      name: 'access',
      type: 'select',
      defaultValue: 'public',
      options: PAGE_ACCESS_OPTIONS,
      admin: {
        position: 'sidebar',
        description:
          'Who can read this post. Ineligible visitors still see it listed, but get a join prompt instead of the body. Admins always have access.',
      },
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
                Gallery,
                Archive,
                Carousel,
                ThreeItemGrid,
                Banner,
                FormBlock,
                Comments,
                Calendar,
                GoogleReviews,
                MediaText,
                Video,
              ],
              required: true,
              // `required` alone reports "The following field is invalid:
              // Content > Layout" — a path, not a problem. An author who just
              // deleted their last block has no idea what to do with that.
              validate: (value: unknown) =>
                Array.isArray(value) && value.length > 0
                  ? true
                  : 'A post needs at least one content block — add a Content block and write the body there.',
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
              hasGenerateFn: true,
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'relatedPosts',
      type: 'relationship',
      relationTo: 'posts',
      hasMany: true,
      admin: {
        position: 'sidebar',
        description: 'Related posts for internal linking',
      },
    },
    {
      name: 'sourceUrl',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Original URL if ingested from external source (YouTube, etc.)',
      },
      index: true,
    },
    {
      name: 'sourceType',
      type: 'select',
      options: [
        { label: 'YouTube', value: 'youtube' },
        { label: 'Vimeo', value: 'vimeo' },
        { label: 'RSS Feed', value: 'rss' },
        { label: 'Manual', value: 'manual' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Where this post was sourced from',
      },
    },
    simpleSlugField,
  ],
  hooks: {
    beforeValidate: [enforceManagedTenant],
    beforeChange: [enforceManagedTenantOnChange, fillMetaFromContent],
    afterChange: [revalidatePost],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 100,
      },
    },
    maxPerDoc: 50,
  },
}
