import path from 'path'
import { fileURLToPath } from 'url'
import { loadEnv } from 'payload/node'

// Ensure env is loaded before Payload evaluates (Payload/Next.js env loading)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
loadEnv(projectRoot)

import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { resendAdapter } from '@payloadcms/email-resend'
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
import { Events } from '@/collections/Events'
import { EventRegistrations } from '@/collections/EventRegistrations'
import { Workflows } from '@/collections/Workflows'
import { TenantMemberships } from '@/collections/TenantMemberships'
import { Tenants } from '@/collections/Tenants'
import { Users } from '@/collections/Users'
import { HolonCapabilities } from '@/collections/HolonCapabilities'
import { JusticeFundTransactions } from '@/collections/JusticeFundTransactions'
import { ProcessedStripeEvents } from '@/collections/ProcessedStripeEvents'
import { ApplicationLogs } from '@/collections/ApplicationLogs'
import { Reviews } from '@/collections/Reviews'
import { Endeavors } from '@/collections/Endeavors'
import { Contacts } from '@/collections/Contacts'
import { FederationAuditLog } from '@/collections/FederationAuditLog'
import { AgentTransactions } from '@/collections/AgentTransactions'
import { MediaMeta } from '@/collections/MediaMeta'
import { plugins } from './plugins'
import { mcpPluginConfig } from './plugins/mcp'
import { exportSite } from '@/endpoints/export-site'
import { chatSendHandler } from '@/endpoints/chat-send'
import { leoChatHandler } from '@/endpoints/leo-chat'
import { leoStreamHandler } from '@/endpoints/leo-stream'
import { aiBusPollHandler } from '@/endpoints/ai-bus-poll'
import { aiBusStreamHandler } from '@/endpoints/ai-bus-stream'
import { spaceCreateHandler } from '@/endpoints/space-create'
import { spaceInviteHandler } from '@/endpoints/space-invite'
import { inviteResendHandler } from '@/endpoints/invite-resend'
import { inviteAcceptHandler } from '@/endpoints/invite-accept'
import { tenantInviteAcceptHandler } from '@/endpoints/tenant-invite-accept'
import { spaceMembersRemoveHandler } from '@/endpoints/space-members'
import { orderRouteHandler } from '@/endpoints/order-route'
import { orderAcceptHandler } from '@/endpoints/order-accept'
import { orderFulfillHandler } from '@/endpoints/order-fulfill'
import { orderShipHandler } from '@/endpoints/order-ship'
import { ordersVendorHandler } from '@/endpoints/orders-vendor'
import { ordersClaimableHandler } from '@/endpoints/orders-claimable'
import { orderClaimHandler } from '@/endpoints/order-claim'
import { orderCancelHandler } from '@/endpoints/order-cancel'
import { makerOpportunitiesHandler } from '@/endpoints/maker-opportunities'
import { stripeConnectOnboardHandler } from '@/endpoints/stripe-connect-onboard'
import { stripeConnectCallbackHandler } from '@/endpoints/stripe-connect-callback'
import { stripeConnectDashboardHandler } from '@/endpoints/stripe-connect-dashboard'
import { stripeWebhooksHandler } from '@/endpoints/stripe-webhooks'
import { liveKitTokenHandler } from '@/endpoints/livekit-token'
import { docsHandler } from '@/endpoints/docs'
import { dmFindOrCreateHandler } from '@/endpoints/dm-find-or-create'
import { bridgeInboundHandler } from '@/endpoints/bridge-inbound'
import { emailPollHandler } from '@/endpoints/email-poll'
import { federationPingHandler } from '@/endpoints/federation-ping'
import { federationHeartbeatHandler } from '@/endpoints/federation-heartbeat'
import { federationHeartbeatCronHandler } from '@/endpoints/federation-heartbeat-cron'
import { federationCatalogHandler } from '@/endpoints/federation-catalog'
import { federationSkillsListHandler, federationSkillsInvokeHandler } from '@/endpoints/federation-skills'
import { federationVouchHandler } from '@/endpoints/federation-vouch'
import { federationGovernanceSyncHandler } from '@/endpoints/federation-governance-sync'
import { mediaAnalyzeHandler } from '@/endpoints/media-analyze'
import { vapiWebhookHandler } from '@/endpoints/vapi-webhook'
import type { Config } from './payload-types'
import { isSuperAdmin } from '@/access/isSuperAdmin'
import { detectTenantFromHostname } from '@/middleware/detectTenant'

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
      afterNavLinks: ['@/components/PayloadAdminLEO#PayloadAdminLEO'],
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
    Workflows,
    Bookings,
    Events,
    EventRegistrations,
    Availability,
    Header,
    Footer,
    Pages,
    Posts,
    Projects,
    Comments,
    Categories,
    Media,
    HolonCapabilities,
    JusticeFundTransactions,
    ProcessedStripeEvents,
    ApplicationLogs,
    Reviews,
    Endeavors,
    Contacts,
    FederationAuditLog,
    AgentTransactions,
    MediaMeta,
  ],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL || '',
      // Drizzle schema introspection fires many concurrent queries at startup.
      // Remote PostgreSQL needs more headroom than a local DB.
      max: process.env.VERCEL ? 3 : 10, // Serverless: low to avoid exhausting PG max_connections; local: higher for Drizzle introspection
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 30_000, // 30s — remote DB needs more time during schema pull
      allowExitOnIdle: true,
    },
  }),
  plugins: [
    ...plugins,
    mcpPluginConfig,
    multiTenantPlugin<Config>({
      tenantsSlug: 'tenants',
      tenantSelectorLabel: 'Tenant',
      collections: {
        // ─── Content & Commerce ──────────────────────────────
        pages: {},
        posts: {},
        projects: {},
        comments: {},
        categories: {},
        media: {},
        products: {},
        orders: {},
        // ─── Soul Data (atomic per-tenant) ───────────────────
        spaces: {},
        'space-memberships': {},
        channels: {},
        messages: {},
        // ─── Scheduling & Events ─────────────────────────────
        bookings: {},
        events: {},
        'event-registrations': {},
        availability: {},
        // ─── System ──────────────────────────────────────────
        workflows: {},
        'holon-capabilities': {},
        'justice-fund-transactions': {},
        contacts: {},
        header: {},
        footer: {},
        // Sprint 18B: Knowledge extraction (not in generated types yet)
        ...({ 'media-meta': {} } as Record<string, object>),
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
  // ─── Email adapter — Resend takes priority, falls back to SMTP nodemailer ──
  ...(process.env.RESEND_API_KEY
    ? {
        email: resendAdapter({
          defaultFromAddress:
            process.env.SYSTEM_EMAIL_ADDRESS ||
            process.env.EMAIL_FROM_ADDRESS ||
            'hello@spacesangels.com',
          defaultFromName:
            process.env.SYSTEM_EMAIL_NAME ||
            process.env.EMAIL_FROM_NAME ||
            'Angel OS',
          apiKey: process.env.RESEND_API_KEY,
        }),
      }
    : process.env.SMTP_HOST
      ? {
          email: nodemailerAdapter({
            defaultFromAddress: process.env.SMTP_FROM_ADDRESS || 'noreply@angelos.app',
            defaultFromName: process.env.SMTP_FROM_NAME || 'Angel OS',
            transportOptions: {
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT) || 587,
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              },
            },
          }),
        }
      : {}),
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
      path: '/chat/send',
      method: 'post',
      handler: chatSendHandler,
    },
    {
      path: '/leo',
      method: 'post',
      handler: leoChatHandler,
    },
    {
      path: '/leo/stream',
      method: 'post',
      handler: leoStreamHandler,
    },
    {
      path: '/comments/add',
      method: 'post',
      handler: async (req) => {
        const { payload, headers } = req
        let tenantSlug = headers.get('x-tenant-id')
        if (!tenantSlug) {
          // Fallback: derive from host using the shared detectTenantFromHostname
          // (x-tenant-id is normally injected by middleware for all /api routes,
          //  but Payload may call this handler server-side without middleware)
          const host = headers.get('host')?.split(':')[0] ?? 'localhost'
          tenantSlug = detectTenantFromHostname(host) ?? (process.env.DEFAULT_TENANT_SLUG || 'default')
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
        // Resolve tenant ID from slug — required, not optional
        if (!tenantSlug) {
          return Response.json({ message: 'Tenant could not be resolved' }, { status: 400 })
        }
        const tenants = await payload.find({
          collection: 'tenants',
          where: { slug: { equals: tenantSlug } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const tenantId: number | undefined = tenants.docs?.[0]?.id
        if (!tenantId) {
          return Response.json({ message: 'Tenant not found' }, { status: 404 })
        }

        // Verify the parent post/product belongs to this tenant (prevents cross-tenant injection)
        const parentDoc = await payload.findByID({
          collection: parentCollection as 'posts' | 'products',
          id: String(parentId),
          depth: 0,
          overrideAccess: true,
          select: { tenant: true } as any,
        })
        const parentTenantId =
          parentDoc && typeof (parentDoc as any).tenant === 'object'
            ? (parentDoc as any).tenant?.id
            : (parentDoc as any)?.tenant
        if (String(parentTenantId) !== String(tenantId)) {
          return Response.json(
            { message: 'Content not found for this tenant' },
            { status: 404 },
          )
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
            tenant: tenantId,
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
    {
      path: '/ai-bus/poll',
      method: 'get',
      handler: aiBusPollHandler,
    },
    {
      path: '/ai-bus/stream',
      method: 'get',
      handler: aiBusStreamHandler,
    },
    // ─── Space Management Endpoints ──────────────────────────────
    {
      path: '/spaces/create',
      method: 'post',
      handler: spaceCreateHandler,
    },
    // ─── Invitation System Endpoints ────────────────────────────
    {
      path: '/spaces/invite',
      method: 'post',
      handler: spaceInviteHandler,
    },
    {
      path: '/spaces/invite/resend',
      method: 'post',
      handler: inviteResendHandler,
    },
    {
      path: '/invite/accept',
      method: 'post',
      handler: inviteAcceptHandler,
    },
    {
      path: '/spaces/members/remove',
      method: 'post',
      handler: spaceMembersRemoveHandler,
    },
    // ─── Tenant Invitation Endpoint ─────────────────────────────
    {
      path: '/tenant-invite/accept',
      method: 'post',
      handler: tenantInviteAcceptHandler,
    },
    // ─── Order Routing & Fulfillment Endpoints ──────────────────
    {
      path: '/orders/route',
      method: 'post',
      handler: orderRouteHandler,
    },
    {
      path: '/orders/accept',
      method: 'post',
      handler: orderAcceptHandler,
    },
    {
      path: '/orders/fulfill',
      method: 'post',
      handler: orderFulfillHandler,
    },
    {
      path: '/orders/ship',
      method: 'post',
      handler: orderShipHandler,
    },
    {
      path: '/orders/vendor',
      method: 'get',
      handler: ordersVendorHandler,
    },
    // ─── Angel Token & Maker Queue Endpoints ──────────────────────
    {
      path: '/orders/claimable',
      method: 'get',
      handler: ordersClaimableHandler,
    },
    {
      path: '/orders/claim',
      method: 'post',
      handler: orderClaimHandler,
    },
    {
      path: '/orders/cancel',
      method: 'post',
      handler: orderCancelHandler,
    },
    {
      path: '/maker-opportunities',
      method: 'get',
      handler: makerOpportunitiesHandler,
    },
    // ─── Stripe Connect Endpoints (Sprint 6) ─────────────────────
    {
      path: '/stripe/connect/onboard',
      method: 'post',
      handler: stripeConnectOnboardHandler,
    },
    {
      path: '/stripe/connect/callback',
      method: 'post',
      handler: stripeConnectCallbackHandler,
    },
    {
      path: '/stripe/connect/dashboard-link',
      method: 'post',
      handler: stripeConnectDashboardHandler,
    },
    {
      path: '/stripe/webhooks',
      method: 'post',
      handler: stripeWebhooksHandler,
    },
    // ─── Vapi Voice AI Webhook (Sprint 19) ────────────────────────
    {
      path: '/vapi/webhook',
      method: 'post',
      handler: vapiWebhookHandler,
    },
    {
      path: '/livekit/token',
      method: 'post',
      handler: liveKitTokenHandler,
    },
    // ─── DM Channel Operations ──────────────────────────────────
    {
      path: '/dm/find-or-create',
      method: 'post',
      handler: dmFindOrCreateHandler,
    },
    // ─── External Bridge Endpoint (Sprint 13 stub) ──────────────
    {
      path: '/bridge/inbound',
      method: 'post',
      handler: bridgeInboundHandler,
    },
    // ─── Email Poll Endpoint (Vercel Cron: */2 * * * *) ─────────
    // Fetches unseen emails from SYSTEM_EMAIL_ADDRESS via IMAP,
    // creates AI Bus channels per sender, replies via Resend.
    {
      path: '/email/poll',
      method: 'get',
      handler: emailPollHandler,
    },
    // ─── Documentation Endpoint ──────────────────────────────────
    {
      path: '/docs',
      method: 'get',
      handler: docsHandler,
    },
    // ─── Federation Network Endpoints (Sprint 17+) ────────────────
    {
      path: '/federation/ping',
      method: 'post',
      handler: federationPingHandler,
    },
    {
      path: '/federation/heartbeat',
      method: 'post',
      handler: federationHeartbeatHandler,
    },
    {
      path: '/federation/heartbeat-cron',
      method: 'get',
      handler: federationHeartbeatCronHandler,
    },
    {
      path: '/federation/catalog',
      method: 'get',
      handler: federationCatalogHandler,
    },
    {
      path: '/federation/skills',
      method: 'get',
      handler: federationSkillsListHandler,
    },
    {
      path: '/federation/skills/invoke',
      method: 'post',
      handler: federationSkillsInvokeHandler,
    },
    {
      path: '/federation/vouch',
      method: 'post',
      handler: federationVouchHandler,
    },
    {
      path: '/federation/governance-sync',
      method: 'post',
      handler: federationGovernanceSyncHandler,
    },
    {
      path: '/federation/governance-sync',
      method: 'get',
      handler: federationGovernanceSyncHandler,
    },
    // ─── Media Analysis Endpoints (Sprint 18B) ─────────────────────
    {
      path: '/media/analyze',
      method: 'post',
      handler: mediaAnalyzeHandler,
    },
  ],
  globals: [],
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
  sharp,
})
