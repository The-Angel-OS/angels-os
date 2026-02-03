import path from 'path'
import { fileURLToPath } from 'url'
import { loadEnv } from 'payload/node'

// Ensure env is loaded before Payload evaluates (Payload/Next.js env loading)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
loadEnv(projectRoot)

import { postgresAdapter } from '@payloadcms/db-postgres'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import sharp from 'sharp'

import {
  BoldFeature,
  EXPERIMENTAL_TableFeature,
  IndentFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  UnderlineFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'

import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { Availability } from '@/collections/Availability'
import { Bookings } from '@/collections/Bookings'
import { Categories } from '@/collections/Categories'
import { Comments } from '@/collections/Comments'
import { Channels } from '@/collections/Channels'
import { Footer } from '@/collections/Footer'
import { Header } from '@/collections/Header'
import { Media } from '@/collections/Media'
import { Messages } from '@/collections/Messages'
import { Pages } from '@/collections/Pages'
import { Posts } from '@/collections/Posts'
import { Projects } from '@/collections/Projects'
import { SpaceMemberships } from '@/collections/SpaceMemberships'
import { Spaces } from '@/collections/Spaces'
import { TenantMemberships } from '@/collections/TenantMemberships'
import { Tenants } from '@/collections/Tenants'
import { Users } from '@/collections/Users'
import { plugins } from './plugins'
import { mcpPluginConfig } from './plugins/mcp'
import { exportSite } from '@/endpoints/export-site'
import type { Config } from './payload-types'
import { isSuperAdmin } from '@/access/isSuperAdmin'

export default buildConfig({
  admin: {
    livePreview: {
      breakpoints: [
        { label: 'Mobile', name: 'mobile', width: 375, height: 667 },
        { label: 'Tablet', name: 'tablet', width: 768, height: 1024 },
        { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
      ],
      collections: ['pages', 'products', 'posts'],
    },
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below and the import `BeforeLogin` statement on line 15.
      beforeLogin: ['@/components/BeforeLogin#BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below and the import `BeforeDashboard` statement on line 15.
      beforeDashboard: ['@/components/BeforeDashboard#BeforeDashboard'],
    },
    user: Users.slug,
  },
  collections: [
    Tenants,
    Users,
    TenantMemberships,
    Spaces,
    SpaceMemberships,
    Channels,
    Messages,
    Bookings,
    Availability,
    Header,
    Footer,
    Pages,
    Posts,
    Projects,
    Comments,
    Categories,
    Media,
  ],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL || '',
    },
  }),
  plugins: [
    ...plugins,
    mcpPluginConfig,
    multiTenantPlugin<Config>({
      tenantsSlug: 'tenants',
      tenantSelectorLabel: 'Tenant',
      collections: {
        pages: {},
        posts: {},
        projects: {},
        comments: {},
        categories: {},
        media: {},
        products: {},
        orders: {},
        bookings: {},
        availability: {},
        header: { isGlobal: true },
        footer: { isGlobal: true },
      },
      userHasAccessToAllTenants: (user) => isSuperAdmin(user as Config['collections']['users'] | null),
      tenantsArrayField: {
        includeDefaultField: true,
      },
      // Allow users with no tenant (e.g. first user before seed) to appear in the Users list
      useUsersTenantFilter: false,
    }),
    vercelBlobStorage({
      enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      collections: {
        media: true,
      },
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    }),
  ],
  editor: lexicalEditor({
    features: () => {
      return [
        UnderlineFeature(),
        BoldFeature(),
        ItalicFeature(),
        OrderedListFeature(),
        UnorderedListFeature(),
        LinkFeature({
          enabledCollections: ['pages', 'posts'],
          fields: ((args: { defaultFields: { name?: string }[] }) => {
            const { defaultFields } = args
            const defaultFieldsWithoutUrl = defaultFields.filter(
              (field: { name?: string }) => !('name' in field && field.name === 'url'),
            )
            return [
              ...defaultFieldsWithoutUrl,
              {
                name: 'url',
                type: 'text',
                admin: {
                  condition: (ctx: { linkType?: string }) => ctx.linkType !== 'internal',
                },
                label: (ctx: { t: (k: string) => string }) => ctx.t('fields:enterURL'),
                required: true,
              },
            ]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- LinkFeature fields type is complex
          }) as any,
        }),
        IndentFeature(),
        EXPERIMENTAL_TableFeature(),
      ]
    },
  }),
  //email: nodemailerAdapter(),
  endpoints: [
    {
      path: '/leo',
      method: 'get',
      handler: async (req) =>
        Response.json({
          status: 'ok',
          service: 'LEO Assistant',
          version: '0.1.0',
          capabilities: ['chat', 'content-query', 'inventory', 'scheduling'],
          tenantId: req.headers.get('x-tenant-id'),
        }),
    },
    {
      path: '/comments/add',
      method: 'post',
      handler: async (req) => {
        const { payload, headers } = req
        let tenantSlug = headers.get('x-tenant-id')
        if (!tenantSlug) {
          const host = headers.get('host')?.split(':')[0] ?? 'localhost'
          tenantSlug =
            host === 'localhost' || host === '127.0.0.1'
              ? process.env.DEFAULT_TENANT_SLUG || 'default'
              : host.replace(/:\d+$/, '').split('.').slice(0, -1).join('-').toLowerCase() || 'default'
        }
        let body: Record<string, unknown>
        try {
          body = (await (req as Request).json()) as Record<string, unknown>
        } catch {
          return Response.json({ message: 'Invalid JSON body' }, { status: 400 })
        }
        const { parentId, parentCollection, author, email, content, rating } = body
        if (
          !parentId ||
          !parentCollection ||
          !author ||
          !email ||
          !content ||
          !['posts', 'products'].includes(parentCollection as string)
        ) {
          return Response.json(
            { message: 'Missing or invalid: parentId, parentCollection, author, email, content' },
            { status: 400 },
          )
        }
        let tenantId: number | undefined
        if (tenantSlug) {
          const tenants = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: tenantSlug } },
            limit: 1,
            depth: 0,
          })
          tenantId = tenants.docs?.[0]?.id
        }
        const doc = await payload.create({
          collection: 'comments',
          data: {
            parent: { relationTo: parentCollection as 'posts' | 'products', value: parentId },
            author: String(author).trim(),
            email: String(email).trim(),
            content: String(content).trim(),
            ...(rating != null && Number.isFinite(Number(rating)) && { rating: Number(rating) }),
            isApproved: false,
            ...(tenantId != null && { tenant: tenantId }),
          } as any,
          overrideAccess: true,
        })
        return Response.json({ doc, message: 'Comment submitted for moderation' })
      },
    },
    {
      path: '/export-site',
      method: 'get',
      handler: exportSite,
    },
  ],
  globals: [],
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
  sharp,
})
