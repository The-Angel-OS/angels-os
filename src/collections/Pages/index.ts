import type { CollectionConfig } from 'payload'

import { Banner } from '@/blocks/Banner/config'
import { Carousel } from '@/blocks/Carousel/config'
import { ThreeItemGrid } from '@/blocks/ThreeItemGrid/config'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { adminOnly } from '@/access/adminOnly'
import { adminOrPortalManager, adminOrPortalManagerCreate } from '@/access/portalManager'
import { enforceManagedTenant, enforceManagedTenantOnChange } from '@/hooks/enforceManagedTenant'
import { Archive } from '@/blocks/ArchiveBlock/config'
import { Comments } from '@/blocks/Comments/config'
import { CallToAction } from '@/blocks/CallToAction/config'
import { Content } from '@/blocks/Content/config'
import { FormBlock } from '@/blocks/Form/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { Calendar } from '@/blocks/Calendar/config'
import { Donation } from '@/blocks/Donation/config'
import { GoogleReviews } from '@/blocks/GoogleReviews/config'
import { MediaText } from '@/blocks/MediaText/config'
import { TicketForm } from '@/blocks/TicketForm/config'
import { TrustRow } from '@/blocks/TrustRow/config'
import { Faq } from '@/blocks/Faq/config'
import { WorkQuizBlock } from '@/blocks/WorkQuiz/config'
import { CoursePlayerBlock } from '@/blocks/CoursePlayer/config'
import { CourseStudioBlock } from '@/blocks/CourseStudio/config'
import { Video } from '@/blocks/Video/config'
import { Showcase } from '@/blocks/Showcase/config'
import { ProductPanel } from '@/blocks/ProductPanel/config'
import { Membership } from '@/blocks/Membership/config'
import { FeaturedEndeavors } from '@/blocks/FeaturedEndeavors/config'
import { MerlinControl } from '@/blocks/MerlinControl/config'
import { Gallery } from '@/blocks/Gallery/config'
// MerlinControl re-registered 2026-06-20 AFTER creating pages_blocks_merlin_control
// (+ versioned) on both prod DBs via /provision-ops/ensure-merlin-block-tables.
// Gallery registered 2026-06-23 AFTER its tables are provisioned on prod via
// /provision-ops/ensure-gallery-block-tables (pages_blocks_gallery + its nested
// images array + the versioned _pages_v counterparts + the columns enum). The
// ensure-table MUST run on each prod DB BEFORE this deploys, or queryPageBySlug
// JOINs a missing relation and throws (home pages fall back to default).
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
import { pagePublishedDirective } from './hooks/pagePublishedDirective'

export const Pages: CollectionConfig = {
  slug: 'pages',
  // Document locking off (Answer 53): the per-collection `payload_locked_documents`
  // lock query is the SOLE failure on every admin save on the angels node — it's the
  // first DB op of a save, so the save aborts there (45s→error). The lock table is
  // empty + the query is fast in isolation, so the fragility is the lock subsystem's
  // interaction with the serverless/pooler connection, not the schema. Locking only
  // guards concurrent-editor collisions (not needed here). See ensure-locked-docs-rels.ts.
  lockDocuments: false,
  access: {
    // See Posts — a portal owner may edit their own pages.
    create: adminOrPortalManagerCreate,
    delete: adminOrPortalManager,
    read: adminOrPublishedWithTenantScope,
    update: adminOrPortalManager,
  },
  admin: {
    group: 'Content',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    listSearchableFields: ['title', 'slug', 'navLabel'],
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
    // Who may VIEW this page. Gated pages also hide from nav for ineligible viewers.
    // Values MUST match PageAccessLevel in src/utilities/pageAccess.ts.
    {
      name: 'access',
      type: 'select',
      defaultValue: 'public',
      options: [
        { label: 'Public — anyone', value: 'public' },
        { label: 'Authenticated — any signed-in user', value: 'authenticated' },
        { label: 'Members — current or lapsing member', value: 'members' },
        { label: 'Members in good standing', value: 'good_standing' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Who can view this page. Non-public pages are hidden from nav for ineligible visitors and show a join prompt instead. Admins always have access.',
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
    /**
     * The menu IS the page tree, so this field is the menu editor.
     *
     * A PLAIN relationship, deliberately not the nested-docs plugin. The column
     * it writes (`pages.parent_id`) is the one that plugin left behind, but the
     * plugin itself is gone from package.json and src/plugins -- what blew up
     * last time was its other half: it rewrites slugs into full paths and
     * rebuilds a `breadcrumbs` array on every save, which is a URL change on
     * live pages disguised as a nav setting. None of that is wanted here. A
     * parent moves where the page appears in the MENU and nothing else; the URL
     * stays `/<slug>`, flat, forever.
     *
     * One level deep is all `injectPagesUnderHome` renders, matching the
     * header's one level of dropdown.
     */
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'pages',
      admin: {
        position: 'sidebar',
        description:
          'Optional. Nest this page under another one in the menu. The address stays /slug — this only changes where it appears in the menu.',
        condition: (data) => data?.showInNav !== false,
      },
      filterOptions: ({ id, data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {}
        // Never offer the page itself: a page parented to itself vanishes from
        // the menu (it nests inside its own dropdown) and is a puzzle to debug.
        if (id) where.id = { not_equals: id }
        // Same portal only. A cross-tenant parent would nest this page under an
        // item that is not in this site's menu at all, so it would silently
        // fall back to Home.
        const tenant = (data as { tenant?: unknown } | undefined)?.tenant
        if (tenant) where.tenant = { equals: typeof tenant === 'object' ? (tenant as { id?: unknown }).id : tenant }
        return where
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
                Comments,
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
                Membership,
                FeaturedEndeavors,
                MerlinControl,
                Gallery,
                GoogleReviews,
                MediaText,
                TicketForm,
                TrustRow,
                Faq,
                Video,
                Showcase,
                ProductPanel,
                WorkQuizBlock,
                CoursePlayerBlock,
                CourseStudioBlock,
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
    beforeValidate: [enforceManagedTenant],
    beforeChange: [enforceManagedTenantOnChange],
    afterChange: [revalidatePage, pagePublishedDirective],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: true,
    },
    maxPerDoc: 50,
  },
}
