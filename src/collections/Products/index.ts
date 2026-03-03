import { CallToAction } from '@/blocks/CallToAction/config'
import { Comments } from '@/blocks/Comments/config'
import { Content } from '@/blocks/Content/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { Calendar } from '@/blocks/Calendar/config'
import { simpleSlugField } from '@/fields/simpleSlugField'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import {
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { DefaultDocumentIDType, Where } from 'payload'

export const ProductsCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  // Allow authenticated users to delete products in their own tenant.
  // The ecommerce plugin defaults to isAdmin-only; we extend it so tenant
  // operators can clean up draft products without needing superAdmin access.
  //
  // Implementation note: We use an async function that calls payload.findByID
  // with overrideAccess:true so we can verify the product's tenant regardless
  // of _status (drafts are invisible to access.read for non-admins, so a plain
  // WHERE constraint would still return 403 because Payload can't find the doc).
  access: {
    ...defaultCollection?.access,
    delete: async ({ req: { user, payload }, id }) => {
      if (!user) return false
      if ((user as any).isSystemUser) return true

      const tenantIds = ((user as any).tenants || []).map((t: any) =>
        t?.tenant && typeof t.tenant === 'object' ? t.tenant.id : t?.tenant,
      ).filter(Boolean)
      if (tenantIds.length === 0) return false

      // Single-doc delete: verify ownership via overrideAccess lookup so draft
      // products (hidden from access.read) can still be deleted by their owner.
      if (id) {
        try {
          const doc = await payload.findByID({
            collection: 'products',
            id,
            overrideAccess: true,
            depth: 0,
          })
          if (!doc) return false
          const docTenantId =
            doc.tenant && typeof doc.tenant === 'object'
              ? (doc.tenant as any).id
              : doc.tenant
          return tenantIds.includes(docTenantId)
        } catch {
          return false
        }
      }

      // Bulk delete fallback: use a where-constraint (only works for published docs).
      return { tenant: { in: tenantIds } }
    },
  },
  admin: {
    ...defaultCollection?.admin,
    defaultColumns: ['title', 'enableVariants', '_status', 'variants.variants'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'products',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'products',
        req,
      }),
    useAsTitle: 'title',
  },
  defaultPopulate: {
    ...defaultCollection?.defaultPopulate,
    title: true,
    slug: true,
    variantOptions: true,
    variants: true,
    enableVariants: true,
    gallery: true,
    priceInUSD: true,
    inventory: true,
    meta: true,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'description',
              type: 'richText',
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                    HorizontalRuleFeature(),
                  ]
                },
              }),
              label: false,
              required: false,
            },
            {
              name: 'gallery',
              type: 'array',
              minRows: 0,
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                },
                {
                  name: 'variantOption',
                  type: 'relationship',
                  relationTo: 'variantOptions',
                  admin: {
                    condition: (data) => {
                      return data?.enableVariants === true && data?.variantTypes?.length > 0
                    },
                  },
                  filterOptions: ({ data }) => {
                    if (data?.enableVariants && data?.variantTypes?.length) {
                      const variantTypeIDs = data.variantTypes.map((item: any) => {
                        if (typeof item === 'object' && item?.id) {
                          return item.id
                        }
                        return item
                      }) as DefaultDocumentIDType[]

                      if (variantTypeIDs.length === 0)
                        return {
                          variantType: {
                            in: [],
                          },
                        }

                      const query: Where = {
                        variantType: {
                          in: variantTypeIDs,
                        },
                      }

                      return query
                    }

                    return {
                      variantType: {
                        in: [],
                      },
                    }
                  },
                },
              ],
            },

            {
              name: 'layout',
              type: 'blocks',
              blocks: [CallToAction, Content, MediaBlock, Comments, Calendar],
            },
          ],
          label: 'Content',
        },
        {
          fields: [
            ...defaultCollection.fields,
            {
              name: 'relatedProducts',
              type: 'relationship',
              filterOptions: ({ id }) => {
                if (id) {
                  return {
                    id: {
                      not_in: [id],
                    },
                  }
                }

                // ID comes back as undefined during seeding so we need to handle that case
                return {
                  id: {
                    exists: true,
                  },
                }
              },
              hasMany: true,
              relationTo: 'products',
            },
          ],
          label: 'Product Details',
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
    {
      name: 'categories',
      type: 'relationship',
      admin: {
        position: 'sidebar',
        sortOptions: 'title',
      },
      hasMany: true,
      relationTo: 'categories',
    },
    // ─── Marketplace & Vendor Fields ─────────────────────────
    {
      name: 'isLimitedEdition',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Mark as limited edition — shown with countdown/badge',
      },
    },
    {
      name: 'availableUntil',
      type: 'date',
      admin: {
        position: 'sidebar',
        description: 'When this limited edition expires',
        condition: (data) => data?.isLimitedEdition === true,
        date: { pickerAppearance: 'dayOnly' },
      },
    },
    {
      name: 'vendor',
      index: true,
      type: 'relationship',
      relationTo: 'tenants',
      admin: {
        position: 'sidebar',
        description: 'Producing vendor tenant (who fulfills this product)',
      },
    },
    {
      name: 'productionType',
      type: 'select',
      options: [
        { label: 'Ready-made', value: 'ready_made' },
        { label: 'Print-on-demand', value: 'print_on_demand' },
        { label: 'Custom order', value: 'custom_order' },
        { label: 'Digital', value: 'digital' },
      ],
      admin: {
        position: 'sidebar',
        description: 'How this product is manufactured',
      },
    },
    {
      name: 'cadFile',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'CAD/design file for CNC, laser-cut, or print-on-demand production (SVG, DXF, STL)',
      },
    },
    {
      name: 'configuratorOptions',
      type: 'json',
      admin: {
        description: 'Product configurator schema: { colors: [...], sizes: [...], customText: boolean, maxTextLength: number }',
      },
    },
    // ─── Network Federation Fields ────────────────────────────
    {
      name: 'networkListing',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'List this product on the Angel OS network for cross-tenant discovery',
      },
    },
    {
      name: 'fulfillmentMode',
      type: 'select',
      defaultValue: 'self',
      options: [
        { label: 'Self-fulfilled', value: 'self' },
        { label: 'Network-routed', value: 'network' },
      ],
      admin: {
        position: 'sidebar',
        description: 'How this product is fulfilled when ordered',
      },
    },
    {
      name: 'requiredCapabilities',
      type: 'array',
      admin: {
        description: 'Skills needed to produce this product (for network matching)',
        condition: (data) => data?.fulfillmentMode === 'network' || data?.networkListing === true,
      },
      fields: [
        {
          name: 'skill',
          type: 'text',
          required: true,
          admin: { description: 'e.g. "screen-printing", "CNC-milling", "embroidery"' },
        },
        {
          name: 'equipment',
          type: 'text',
          admin: {
            description: 'Preferred equipment type (e.g. "CNC router", "Homag Centateq P-110", "UV printer"). Optional — used for bonus matching, not hard requirement.',
          },
        },
        {
          name: 'materials',
          type: 'json',
          admin: { description: 'Required materials, e.g. ["cotton", "polyester", "Baltic birch plywood"]' },
        },
      ],
    },
    // ─── Revenue Split Participants ──────────────────────────
    // Designer gets design cut, manufacturer gets manufacturing cut.
    // Ultimate Fair — minimum extraction, maximum enablement.
    {
      name: 'participants',
      type: 'array',
      admin: {
        description: 'Revenue split participants — designer, manufacturer, licensor, etc. Percentages must sum to ≤100.',
      },
      fields: [
        {
          name: 'role',
          type: 'select',
          required: true,
          options: [
            { label: 'Designer', value: 'designer' },
            { label: 'Manufacturer', value: 'manufacturer' },
            { label: 'Licensor', value: 'licensor' },
            { label: 'Affiliate', value: 'affiliate' },
            { label: 'Contributor', value: 'contributor' },
          ],
          admin: { description: 'Participant role in revenue split' },
        },
        {
          name: 'entity',
          type: 'relationship',
          relationTo: ['users', 'tenants'],
          required: true,
          admin: { description: 'User or tenant who receives this share' },
        },
        {
          name: 'percentage',
          type: 'number',
          required: true,
          min: 0,
          max: 100,
          admin: { description: 'Share of the provider portion (e.g. 60% provider split gets divided among participants)' },
        },
        {
          name: 'label',
          type: 'text',
          admin: { description: 'Human-readable label (e.g. "Sarah — Original Design")' },
        },
      ],
    },
    // ─── Sprint 21: Inventory Management ─────────────────────
    {
      name: 'lowStockThreshold',
      type: 'number',
      defaultValue: 10,
      admin: {
        position: 'sidebar',
        description: 'Alert when inventory drops below this number',
      },
    },
    simpleSlugField,
  ],
})
