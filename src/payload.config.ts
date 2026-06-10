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
import { SiteSettings } from '@/collections/SiteSettings'
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
import { Presence } from '@/collections/Presence'
import { Settings } from '@/collections/Settings'
import { Permissions } from '@/collections/Permissions'
import { Vendors } from '@/collections/Vendors'
import { Users } from '@/collections/Users'
import { HolonCapabilities } from '@/collections/HolonCapabilities'
import { JusticeFundTransactions } from '@/collections/JusticeFundTransactions'
import { ProcessedStripeEvents } from '@/collections/ProcessedStripeEvents'
import { ApplicationLogs } from '@/collections/ApplicationLogs'
import { CostEvents } from '@/collections/CostEvents'
import { Reviews } from '@/collections/Reviews'
import { Endeavors } from '@/collections/Endeavors'
import { FederationPeers } from '@/collections/FederationPeers'
import { Connectors } from '@/collections/Connectors'
import { Contacts } from '@/collections/Contacts'
import { FederationAuditLog } from '@/collections/FederationAuditLog'
import { AgentTransactions } from '@/collections/AgentTransactions'
import { MediaMeta } from '@/collections/MediaMeta'
import { StreetSigns } from '@/collections/StreetSigns'
import { Quests } from '@/collections/Quests'
import { QuestParticipations } from '@/collections/QuestParticipations'
import { BoardMembers } from '@/collections/BoardMembers'
import { LogisticsNodes, Transports, Shipments } from '@/collections/Logistics'
import { Pheromones, WorkUnits } from '@/collections/Intelligence'
import { CrewAssignments } from '@/collections/CrewAssignments'
import { plugins } from './plugins'
import { mcpPluginConfig } from './plugins/mcp'
import { exportSite } from '@/endpoints/export-site'
import { chatSendHandler } from '@/endpoints/chat-send'
import { leoChatHandler } from '@/endpoints/leo-chat'
import { leoStreamHandler } from '@/endpoints/leo-stream'
import { aiBusPollHandler } from '@/endpoints/ai-bus-poll'
import { aiBusStreamHandler } from '@/endpoints/ai-bus-stream'
import { spaceCreateHandler } from '@/endpoints/space-create'
import { spaceProvisionChannelsHandler } from '@/endpoints/space-provision-channels'
import { spaceInviteHandler } from '@/endpoints/space-invite'
import { inviteResendHandler } from '@/endpoints/invite-resend'
import { inviteAcceptHandler } from '@/endpoints/invite-accept'
import { tenantInviteAcceptHandler } from '@/endpoints/tenant-invite-accept'
import { spaceMembersRemoveHandler, spaceMemberCandidatesHandler, spaceMemberAddHandler } from '@/endpoints/space-members'
import { orderRouteHandler } from '@/endpoints/order-route'
import { orderAcceptHandler } from '@/endpoints/order-accept'
import { orderFulfillHandler } from '@/endpoints/order-fulfill'
import { orderShipHandler } from '@/endpoints/order-ship'
import { ordersVendorHandler } from '@/endpoints/orders-vendor'
import { ordersClaimableHandler } from '@/endpoints/orders-claimable'
import { bookingAvailableSlotsHandler } from '@/endpoints/booking-available-slots'
import { presencePingHandler } from '@/endpoints/presence-ping'
import { presenceOnlineHandler } from '@/endpoints/presence-online'
import { clientErrorHandler } from '@/endpoints/client-error'
import { provisionWdegPortalHandler } from '@/endpoints/provision-wdeg-portal'
import { provisionPortalHandler } from '@/endpoints/provision-portal'
import { ensureSpacesHandler } from '@/endpoints/ensure-spaces'
import { commentFlagHandler } from '@/endpoints/comment-flag'
import { ensurePageChannelsHandler } from '@/endpoints/ensure-page-channels'
import { verifyOnboardingHandler } from '@/endpoints/verify-onboarding'
import { ensureFoundersHandler } from '@/endpoints/ensure-founders'
import { dbRepairLocksHandler } from '@/endpoints/db-repair-locks'
import { setMembershipHandler } from '@/endpoints/set-membership'
import { bookingCheckoutHandler } from '@/endpoints/booking-checkout'
import { orderClaimHandler } from '@/endpoints/order-claim'
import { orderCancelHandler } from '@/endpoints/order-cancel'
import { makerOpportunitiesHandler } from '@/endpoints/maker-opportunities'
import { stripeConnectOnboardHandler } from '@/endpoints/stripe-connect-onboard'
import { stripeConnectCallbackHandler } from '@/endpoints/stripe-connect-callback'
import { stripeConnectDashboardHandler } from '@/endpoints/stripe-connect-dashboard'
import { stripeConnectDisconnectHandler } from '@/endpoints/stripe-connect-disconnect'
import { stripeWebhooksHandler } from '@/endpoints/stripe-webhooks'
import { donationCreateIntentHandler } from '@/endpoints/donation-create-intent'
import { worksSealHandler, worksManifestHandler } from '@/endpoints/works-seal'
import { federationSimulateHandler } from '@/endpoints/federation-simulate'
import { debugConnectivityHandler } from '@/endpoints/debug-connectivity'
import { federationBootstrapHandler } from '@/endpoints/federation-bootstrap'
import { dashboardPrefsHandler } from '@/endpoints/dashboard-prefs'
import { worksTranslateHandler } from '@/endpoints/works-translate'
import { liveKitTokenHandler } from '@/endpoints/livekit-token'
import { docsHandler } from '@/endpoints/docs'
import { dmFindOrCreateHandler } from '@/endpoints/dm-find-or-create'
import { bridgeInboundHandler } from '@/endpoints/bridge-inbound'
import { connectorTestHandler } from '@/endpoints/connector-test'
import { connectorHealthCronHandler } from '@/endpoints/connector-health-cron'
import { emailPollHandler } from '@/endpoints/email-poll'
import { youtubePollHandler } from '@/endpoints/youtube-poll'
import { gotifyPollHandler } from '@/endpoints/gotify-poll'
import { federationPingHandler } from '@/endpoints/federation-ping'
import { federationHeartbeatHandler } from '@/endpoints/federation-heartbeat'
import { federationHeartbeatCronHandler } from '@/endpoints/federation-heartbeat-cron'
import { federationCatalogHandler } from '@/endpoints/federation-catalog'
import { federationHolonsHandler } from '@/endpoints/federation-holons'
import { federationSkillsListHandler, federationSkillsInvokeHandler } from '@/endpoints/federation-skills'
import { federationVouchHandler } from '@/endpoints/federation-vouch'
import { federationGovernanceSyncHandler } from '@/endpoints/federation-governance-sync'
import { mediaAnalyzeHandler } from '@/endpoints/media-analyze'
import { suitcaseApplyHandler } from '@/endpoints/suitcase-apply'
import { vapiWebhookHandler } from '@/endpoints/vapi-webhook'
import { vapiSetupHandler } from '@/endpoints/vapi-setup'
import { federationElectionHandler } from '@/endpoints/federation-election'
import { federationSuitcaseExportHandler, federationSuitcaseImportHandler } from '@/endpoints/federation-suitcase'
import { authGoogleInitHandler, authGoogleCallbackHandler } from '@/endpoints/auth-google'
import { authTokenRelayHandler } from '@/endpoints/auth-token-relay'
import { authSystemTokenHandler } from '@/endpoints/auth-system-token'
import { authSocialUnlinkHandler } from '@/endpoints/auth-social-unlink'
import { beneficiaryClaimHandler } from '@/endpoints/beneficiary-claim'
import { federationMigrateHandler } from '@/endpoints/federation-migrate'
import { federationDispatchWorkHandler } from '@/endpoints/federation-dispatch-work'
import { federationPulseHandler } from '@/endpoints/federation-pulse'
import { federationMessageHandler } from '@/endpoints/federation-message'
import { cicStatusHandler } from '@/endpoints/cic-status'
import { aiCostsHandler } from '@/endpoints/ai-costs'
import { costStorageProbeHandler } from '@/endpoints/cost-storage-probe'
import { livekitWebhookHandler } from '@/endpoints/livekit-webhook'
import { updateAllNavHandler } from '@/endpoints/update-all-nav'
import { vercelSpendWebhookHandler } from '@/endpoints/vercel-spend-webhook'
import { authDiscordInitHandler, authDiscordCallbackHandler } from '@/endpoints/auth-discord'
import { authGithubInitHandler, authGithubCallbackHandler } from '@/endpoints/auth-github'
import { discordWebhookHandler } from '@/endpoints/discord-webhook'
import { whatsappWebhookHandler, whatsappWebhookVerifyHandler } from '@/endpoints/whatsapp-webhook'
import { telegramWebhookHandler } from '@/endpoints/telegram-webhook'
import { smsWebhookHandler } from '@/endpoints/sms-webhook'
import { slackWebhookHandler } from '@/endpoints/slack-webhook'
import type { Config } from './payload-types'
import { isSuperAdmin } from '@/access/isSuperAdmin'
import { detectTenantFromHostname } from '@/middleware/detectTenant'

export default buildConfig({
  // ─── CORS ─────────────────────────────────────────────────────────────────
  // Allow all origins under *.spacesangels.com and *.kendev.co so tenant
  // subdomains can make credentialed Payload API calls (e.g. /api/users/me).
  // Payload's cors accepts string globs via micromatch.
  // Note: the primary cross-subdomain auth fix is in AuthProvider (uses
  // window.location.origin so calls are same-origin). This is belt-and-suspenders
  // for federation, partner embeds, and any remaining cross-origin fetch paths.
  cors: [
    'https://spacesangels.com',
    'https://www.spacesangels.com',
    'https://*.spacesangels.com',
    'https://kendev.co',
    'https://www.kendev.co',
    'https://*.kendev.co',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  admin: {
    meta: {
      titleSuffix: ' — Angel OS',
    },
    livePreview: {
      breakpoints: [
        { label: 'Mobile', name: 'mobile', width: 375, height: 667 },
        { label: 'Tablet', name: 'tablet', width: 768, height: 1024 },
        { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
      ],
      collections: ['pages', 'products', 'posts'],
    },
    components: {
      graphics: {
        Logo: '@/components/AdminLogo#AdminLogo',
        Icon: '@/components/AdminIcon#AdminIcon',
      },
      beforeLogin: ['@/components/BeforeLogin#BeforeLogin'],
      beforeDashboard: ['@/components/BeforeDashboard#BeforeDashboard'],
      afterNavLinks: ['@/components/PayloadAdminLEO#PayloadAdminLEO'],
      beforeNav: ['@/components/TenantAutoSelector#TenantAutoSelector'],
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
    SiteSettings,
    Pages,
    Posts,
    Projects,
    Comments,
    Presence,
    Settings,
    Permissions,
    Vendors,
    Categories,
    Media,
    HolonCapabilities,
    JusticeFundTransactions,
    ProcessedStripeEvents,
    ApplicationLogs,
    CostEvents,
    Reviews,
    Endeavors,
    FederationPeers,
    Connectors,
    Contacts,
    FederationAuditLog,
    AgentTransactions,
    MediaMeta,
    StreetSigns,
    Quests,
    QuestParticipations,
    BoardMembers,
    LogisticsNodes,
    Transports,
    Shipments,
    Pheromones,
    WorkUnits,
    CrewAssignments,
  ],
  db: postgresAdapter({
    // PAYLOAD_SKIP_PUSH=true disables dev-mode schema push — lets you run `next
    // dev` against a remote/prod DB (e.g. a shared node) WITHOUT mutating its
    // schema or hanging on an interactive create-vs-rename prompt. Default
    // (undefined) keeps Payload's normal behavior (push in dev).
    push: process.env.PAYLOAD_SKIP_PUSH === 'true' ? false : undefined,
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
        reviews: {},
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
        'site-settings': {},
        settings: {},
        permissions: {},
        vendors: {},
        // ─── Sprint 18B/19/20 ──────────────────────────────
        'media-meta': {},
        connectors: {},
        // ─── Sprint 20: Federation ──────────────────────────
        endeavors: {},
        'crew-assignments': {},
        'street-signs': {},
        // ─── Sprint 23: Quests ──────────────────────────────
        quests: {},
        'quest-participations': {},
        // ─── Sprint 24: Board governance ────────────────────
        'board-members': {},
        // ─── Sprint 27: Universal Logistics Network ─────────
        'logistics-nodes': {},
        transports: {},
        shipments: {},
        // ─── Sprint 29: Pheromone Grid (Swarm Intelligence) ─
        pheromones: {},
        // ─── Sprint 30: Distributed Workload Engine ───────────
        'work-units': {},
        // ─── Operating-Costs ledger (unified cost tracking) ───
        'cost-events': {},
      } as any,
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
      path: '/presence-ops/ping',
      method: 'post',
      handler: presencePingHandler,
    },
    {
      path: '/presence-ops/online',
      method: 'get',
      handler: presenceOnlineHandler,
    },
    {
      path: '/log-ops/client-error',
      method: 'post',
      handler: clientErrorHandler,
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
    // Note: paths use /space-ops/ prefix to avoid collision with the
    // 'spaces' collection REST API which intercepts /spaces/* POST routes.
    {
      path: '/space-ops/create',
      method: 'post',
      handler: spaceCreateHandler,
    },
    {
      path: '/space-ops/provision-channels',
      method: 'post',
      handler: spaceProvisionChannelsHandler,
    },
    // ─── Invitation System Endpoints ────────────────────────────
    {
      path: '/space-ops/invite',
      method: 'post',
      handler: spaceInviteHandler,
    },
    {
      path: '/space-ops/invite/resend',
      method: 'post',
      handler: inviteResendHandler,
    },
    {
      path: '/invite/accept',
      method: 'post',
      handler: inviteAcceptHandler,
    },
    {
      path: '/space-ops/members/remove',
      method: 'post',
      handler: spaceMembersRemoveHandler,
    },
    {
      path: '/space-ops/members/candidates',
      method: 'get',
      handler: spaceMemberCandidatesHandler,
    },
    {
      path: '/space-ops/members/add',
      method: 'post',
      handler: spaceMemberAddHandler,
    },
    // ─── Tenant Invitation Endpoint ─────────────────────────────
    {
      path: '/tenant-invite/accept',
      method: 'post',
      handler: tenantInviteAcceptHandler,
    },
    // ─── Order Routing & Fulfillment Endpoints ──────────────────
    // Note: paths use /order-ops/ prefix to avoid collision with the
    // 'orders' collection REST API which intercepts /orders/* POST routes.
    {
      path: '/order-ops/route',
      method: 'post',
      handler: orderRouteHandler,
    },
    {
      path: '/order-ops/accept',
      method: 'post',
      handler: orderAcceptHandler,
    },
    {
      path: '/order-ops/fulfill',
      method: 'post',
      handler: orderFulfillHandler,
    },
    {
      path: '/order-ops/ship',
      method: 'post',
      handler: orderShipHandler,
    },
    {
      path: '/order-ops/vendor',
      method: 'get',
      handler: ordersVendorHandler,
    },
    // ─── Booking Endpoints ────────────────────────────────────────
    // Note: paths use /booking-ops/ prefix to avoid collision with the
    // 'bookings' collection REST API.
    {
      path: '/booking-ops/available-slots',
      method: 'post',
      handler: bookingAvailableSlotsHandler,
    },
    // One-shot, super_admin-only, idempotent: provisions the WDEG portal tenant.
    // GET so an authenticated super_admin can trigger it from the browser.
    {
      path: '/provision-ops/wdeg-portal',
      method: 'get',
      handler: provisionWdegPortalHandler,
    },
    // Generic param-driven portal provisioner (any node, as it comes online).
    {
      path: '/provision-ops/portal',
      method: 'post',
      handler: provisionPortalHandler,
    },
    // Idempotent self-heal: ensure a tenant's baseline Spaces/Channels exist.
    // GET so a super_admin can trigger it from the browser (?tenant=<slug> | ?all=1).
    {
      path: '/provision-ops/ensure-spaces',
      method: 'get',
      handler: ensureSpacesHandler,
    },
    // Report a page comment for moderation (any authed user; non-destructive).
    {
      path: '/comment-ops/flag',
      method: 'post',
      handler: commentFlagHandler,
    },
    // Backfill Channel docs for pre-existing page: messages (idempotent).
    {
      path: '/provision-ops/ensure-page-channels',
      method: 'get',
      handler: ensurePageChannelsHandler,
    },
    // Repeatable onboarding invariant check: AI Bus + Main + DM spaces, page
    // channels re-homed onto the AI Bus, members backfilled into spaces.
    // GET so a super_admin can trigger from the browser (?tenant=<slug> | ?all=1).
    {
      path: '/provision-ops/verify-onboarding',
      method: 'get',
      handler: verifyOnboardingHandler,
    },
    // Idempotently sync FOUNDER_ACCOUNTS → super_admin (lightweight seed slice).
    // GET; super_admin or ?key=CRON_SECRET.
    {
      path: '/provision-ops/ensure-founders',
      method: 'get',
      handler: ensureFoundersHandler,
    },
    // Idempotent DB self-heal: ensure payload_locked_documents_rels has every
    // collection column (dev-push drift breaks the lock query → write failures).
    {
      path: '/provision-ops/db-repair-locks',
      method: 'get',
      handler: dbRepairLocksHandler,
    },
    // Factory primitive: grant a user tenant-scoped access (find-or-create user +
    // active tenant-membership at a role). POST; super_admin or ?key=CRON_SECRET.
    {
      path: '/provision-ops/set-membership',
      method: 'post',
      handler: setMembershipHandler,
    },
    {
      path: '/booking-ops/checkout',
      method: 'post',
      handler: bookingCheckoutHandler,
    },
    // ─── Angel Token & Maker Queue Endpoints ──────────────────────
    {
      path: '/order-ops/claimable',
      method: 'get',
      handler: ordersClaimableHandler,
    },
    {
      path: '/order-ops/claim',
      method: 'post',
      handler: orderClaimHandler,
    },
    {
      path: '/order-ops/cancel',
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
      path: '/stripe/connect/disconnect',
      method: 'post',
      handler: stripeConnectDisconnectHandler,
    },
    {
      path: '/stripe/webhooks',
      method: 'post',
      handler: stripeWebhooksHandler,
    },
    // ─── Donations (Sprint 43) ────────────────────────────────────
    {
      path: '/donation-ops/create-intent',
      method: 'post',
      handler: donationCreateIntentHandler,
    },
    // ─── Works Engine — seal / serve / translate (slice #2) ───────
    {
      path: '/works-ops/seal',
      method: 'post',
      handler: worksSealHandler,
    },
    {
      path: '/works-ops/manifest',
      method: 'get',
      handler: worksManifestHandler,
    },
    {
      path: '/works-ops/translate',
      method: 'post',
      handler: worksTranslateHandler,
    },
    // ─── Emergent network mockup (Central testbed) ────────────────
    {
      path: '/federation/simulate',
      method: 'get',
      handler: federationSimulateHandler,
    },
    // ─── Debug connectivity — which DB / node is this? ────────────
    {
      path: '/debug/connectivity',
      method: 'get',
      handler: debugConnectivityHandler,
    },
    // ─── Dashboard widget prefs (collapsed/dismissed/order) ───────
    {
      path: '/dashboard-ops/prefs',
      method: 'post',
      handler: dashboardPrefsHandler,
    },
    // ─── Federation bootstrap — first contact with the registry peer ──
    {
      path: '/federation/bootstrap',
      method: 'post',
      handler: federationBootstrapHandler,
    },
    {
      path: '/federation/bootstrap',
      method: 'get',
      handler: federationBootstrapHandler,
    },
    // ─── Vapi Voice AI (Sprint 19) ─────────────────────────────────
    {
      path: '/vapi/webhook',
      method: 'post',
      handler: vapiWebhookHandler,
    },
    {
      path: '/vapi/setup',
      method: 'post',
      handler: vapiSetupHandler,
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
    // ─── Connector Health Probe ───────────────────────────────────
    // NOTE: paths MUST NOT start with `/connectors` — that's a collection slug,
    // so Payload's collection REST routes (/api/connectors/:id) shadow them and
    // return "Route not found". Use the `-ops` suffix convention (Sprint 42 rule).
    {
      path: '/connector-ops/test',
      method: 'post',
      handler: connectorTestHandler,
    },
    // ─── Connector Health Cron (Vercel Cron: */30 * * * *) ───────
    {
      path: '/connector-ops/health',
      method: 'get',
      handler: connectorHealthCronHandler,
    },
    // ─── Email Poll Endpoint (Vercel Cron: */2 * * * *) ─────────
    // Fetches unseen emails from SYSTEM_EMAIL_ADDRESS via IMAP,
    // creates AI Bus channels per sender, replies via Resend.
    {
      path: '/email/poll',
      method: 'get',
      handler: emailPollHandler,
    },
    // ─── YouTube Channel Poll (Vercel Cron: 0 * * * *) ───────────
    // Polls YouTube RSS feeds for all youtube_channel connectors,
    // creates Posts for new videos with deduplication via sourceUrl.
    {
      path: '/youtube/poll',
      method: 'get',
      handler: youtubePollHandler,
    },
    // ─── Gotify Inbound Poll (Vercel Cron: */5 * * * *) ──────────
    // Mirrors Gotify server messages (Uptime-Kuma, system alerts) onto the
    // AI Bus for all enabled gotify connectors; dedupes by Gotify message id.
    {
      path: '/gotify/poll',
      method: 'get',
      handler: gotifyPollHandler,
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
      path: '/federation/holons',
      method: 'get',
      handler: federationHolonsHandler,
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
    // ─── Suitcase Apply (portable Endeavor import) ──────────────
    {
      path: '/suitcase/apply',
      method: 'post',
      handler: suitcaseApplyHandler,
    },
    // ─── Federation Sprint 20: Election, Suitcase, Street Signs ─────
    {
      path: '/federation/election',
      method: 'post',
      handler: federationElectionHandler,
    },
    {
      path: '/federation/election',
      method: 'get',
      handler: federationElectionHandler,
    },
    {
      path: '/federation/suitcase/export',
      method: 'post',
      handler: federationSuitcaseExportHandler,
    },
    {
      path: '/federation/suitcase/import',
      method: 'post',
      handler: federationSuitcaseImportHandler,
    },
    {
      path: '/federation/migrate',
      method: 'post',
      handler: federationMigrateHandler,
    },
    // ─── Social Auth Endpoints (Sprint 23) ──────────────────────
    {
      path: '/auth/google',
      method: 'get',
      handler: authGoogleInitHandler,
    },
    {
      path: '/auth/google/callback',
      method: 'get',
      handler: authGoogleCallbackHandler,
    },
    {
      path: '/auth/token-relay',
      method: 'get',
      handler: authTokenRelayHandler,
    },
    {
      path: '/auth/system-token',
      method: 'post',
      handler: authSystemTokenHandler,
    },
    {
      path: '/auth/social-unlink',
      method: 'post',
      handler: authSocialUnlinkHandler,
    },
    // ─── Beneficiary Verification (Sprint 25) ──────────────────
    {
      path: '/beneficiary/claim',
      method: 'post',
      handler: beneficiaryClaimHandler,
    },
    // ─── Distributed Workload Dispatch (Sprint 31) ──────────────
    {
      path: '/federation/dispatch-work',
      method: 'post',
      handler: federationDispatchWorkHandler,
    },
    // ─── Sprint 32: Federation Pulse ────────────────────────────
    {
      path: '/federation/pulse',
      method: 'get',
      handler: federationPulseHandler,
    },
    // ─── Sprint 36: Federation AI Bus ──────────────────────────
    {
      path: '/federation/message',
      method: 'post',
      handler: federationMessageHandler,
    },
    // ─── Sprint 33: Discord Integration ───────────────────────
    {
      path: '/auth/discord',
      method: 'get',
      handler: authDiscordInitHandler,
    },
    {
      path: '/auth/discord/callback',
      method: 'get',
      handler: authDiscordCallbackHandler,
    },
    {
      path: '/discord/webhook',
      method: 'post',
      handler: discordWebhookHandler,
    },
    // ─── Sprint 37: GitHub Integration ──────────────────────
    {
      path: '/auth/github',
      method: 'get',
      handler: authGithubInitHandler,
    },
    {
      path: '/auth/github/callback',
      method: 'get',
      handler: authGithubCallbackHandler,
    },
    // ─── WhatsApp Cloud API Webhook ────────────────────────────
    {
      path: '/whatsapp/webhook',
      method: 'get',
      handler: whatsappWebhookVerifyHandler,
    },
    {
      path: '/whatsapp/webhook',
      method: 'post',
      handler: whatsappWebhookHandler,
    },
    // ─── Telegram Bot API Webhook ─────────────────────────────
    {
      path: '/telegram/webhook',
      method: 'post',
      handler: telegramWebhookHandler,
    },
    // ─── Twilio SMS Webhook ─────────────────────────────────
    {
      path: '/sms/webhook',
      method: 'post',
      handler: smsWebhookHandler,
    },
    {
      path: '/slack/webhook',
      method: 'post',
      handler: slackWebhookHandler,
    },
    // ─── CIC Status (Sprint 40) ───────────────────────────────
    {
      path: '/cic/status',
      method: 'get',
      handler: cicStatusHandler,
    },
    // ─── AI Costs (control-panel economics) ───────────────────
    {
      path: '/cic/ai-costs',
      method: 'get',
      handler: aiCostsHandler,
    },
    // ─── Operating-Costs sources ──────────────────────────────
    {
      path: '/cost-ops/storage-probe',
      method: 'get',
      handler: costStorageProbeHandler,
    },
    {
      path: '/cost-ops/storage-probe',
      method: 'post',
      handler: costStorageProbeHandler,
    },
    {
      path: '/webhooks/livekit',
      method: 'post',
      handler: livekitWebhookHandler,
    },
    // ─── Admin: Update All Nav ───────────────────────────────
    {
      path: '/admin-ops/update-all-nav',
      method: 'post',
      handler: updateAllNavHandler,
    },
    // ─── Vercel Spend Webhook (Sprint 40) ─────────────────────
    {
      path: '/webhooks/vercel-spend',
      method: 'post',
      handler: vercelSpendWebhookHandler,
    },
  ],
  globals: [],
  secret: (() => {
    const s = process.env.PAYLOAD_SECRET
    if (!s || s.length < 32) {
      throw new Error(
        'PAYLOAD_SECRET must be set and at least 32 characters. ' +
        'Generate one with: openssl rand -hex 32',
      )
    }
    return s
  })(),
  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
  sharp,
})
