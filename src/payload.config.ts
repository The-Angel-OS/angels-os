import path from 'path'
import { fileURLToPath } from 'url'
import { loadEnv } from 'payload/node'

// Ensure env is loaded before Payload evaluates (Payload/Next.js env loading)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
loadEnv(projectRoot)

import { afterErrorHook } from '@/utilities/payloadAfterError'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { resendAdapter } from '@payloadcms/email-resend'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { mediaStoragePlugin } from '@/utilities/mediaStorage'
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
import { adminOrSelfFieldAccess } from '@/access/adminOrSelfFieldAccess'
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
import { SiteVisits } from '@/collections/SiteVisits'
import { Reviews } from '@/collections/Reviews'
import { Endeavors } from '@/collections/Endeavors'
import { FederationPeers } from '@/collections/FederationPeers'
import { Connectors } from '@/collections/Connectors'
import { Contacts } from '@/collections/Contacts'
import { Partners } from '@/collections/Partners'
import { Tickets } from '@/collections/Tickets'
import { Sequences } from '@/collections/Sequences'
import { SequenceEnrollments } from '@/collections/SequenceEnrollments'
import { Redirects } from '@/collections/Redirects'
import { FederationAuditLog } from '@/collections/FederationAuditLog'
import { AgentTransactions } from '@/collections/AgentTransactions'
import { MediaMeta } from '@/collections/MediaMeta'
import { StreetSigns } from '@/collections/StreetSigns'
import { Quests } from '@/collections/Quests'
import { QuestParticipations } from '@/collections/QuestParticipations'
import { TokenLedger } from '@/collections/TokenLedger'
import { Wallets } from '@/collections/Wallets'
import { Signatures } from '@/collections/Signatures'
import { Memberships } from '@/collections/Memberships'
import { Services } from '@/collections/Services'
import { Works } from '@/collections/Works'
import { BoardMembers } from '@/collections/BoardMembers'
import { LogisticsNodes, Transports, Shipments } from '@/collections/Logistics'
import { Pheromones, WorkUnits } from '@/collections/Intelligence'
import { CrewAssignments } from '@/collections/CrewAssignments'
import { plugins } from './plugins'
import { mcpPluginConfig } from './plugins/mcp'
import { exportSite } from '@/endpoints/export-site'
import { teleportImportHandler } from '@/endpoints/teleport-import'
import { chatSendHandler } from '@/endpoints/chat-send'
import { leoChatHandler } from '@/endpoints/leo-chat'
import { leoStreamHandler } from '@/endpoints/leo-stream'
import { aiBusPollHandler } from '@/endpoints/ai-bus-poll'
import { aiBusStreamHandler } from '@/endpoints/ai-bus-stream'
import { spaceDeleteHandler } from '@/endpoints/space-delete'
import { spaceCreateHandler } from '@/endpoints/space-create'
import { spaceProvisionChannelsHandler } from '@/endpoints/space-provision-channels'
import { spaceInviteHandler } from '@/endpoints/space-invite'
import { inviteResendHandler } from '@/endpoints/invite-resend'
import { worksListHandler, worksGetHandler, worksImportHandler, worksChecksumsHandler, worksPullHandler, worksDailyHandler } from '@/endpoints/works'
import { logConsolidateHandler } from '@/endpoints/log-consolidate'
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
import { bookingPublicSlotsHandler } from '@/endpoints/booking-public-slots'
import { bookingSetHoursHandler } from '@/endpoints/booking-set-hours'
import { siteLogReportHandler } from '@/endpoints/site-log-report'
import { postMetaRepairHandler } from '@/endpoints/post-meta-repair'
import { captureHandler, captureOptionsHandler } from '@/endpoints/capture'
import { sequenceTickHandler } from '@/endpoints/sequence-tick'
import { presencePingHandler } from '@/endpoints/presence-ping'
import { presenceOnlineHandler } from '@/endpoints/presence-online'
import { clientErrorHandler } from '@/endpoints/client-error'
import { provisionWdegPortalHandler } from '@/endpoints/provision-wdeg-portal'
import { provisionPortalHandler } from '@/endpoints/provision-portal'
import { demoSiteHandler } from '@/endpoints/demo-site'
import { prospectIntakeHandler } from '@/endpoints/prospect-intake'
import { navOverridesGetHandler, navOverridesPostHandler } from '@/endpoints/nav-overrides'
import { signupFormSetupHandler } from '@/endpoints/signup-form-setup'
import { decommissionPortalHandler } from '@/endpoints/decommission-portal'
import { portalInvitesHandler } from '@/endpoints/portal-invites'
import { aiStatusHandler } from '@/endpoints/ai-status'
import { claimGuardianAngelHandler } from '@/endpoints/claim-guardian-angel'
import { guardianAngelStatusHandler } from '@/endpoints/guardian-angel-status'
import { guardianAngelDiagnoseHandler } from '@/endpoints/guardian-angel-diagnose'
import { solvencySnapshotHandler } from '@/endpoints/solvency-snapshot'
import { solvencyBriefingHandler } from '@/endpoints/solvency-briefing'
import { renamePortalSlugHandler } from '@/endpoints/rename-portal-slug'
import { guardianAngelCheckoutHandler } from '@/endpoints/guardian-angel-checkout'
import { ensureGuardianAngelColumnHandler } from '@/endpoints/ensure-guardian-angel-column'
import { personalAgendaHandler } from '@/endpoints/personal-agenda'
import { dailyBreadProgressHandler } from '@/endpoints/daily-bread-progress'
import { dispatchRouteHandler } from '@/endpoints/dispatch-route'
import { ensureSpacesHandler } from '@/endpoints/ensure-spaces'
import { commentFlagHandler } from '@/endpoints/comment-flag'
import { ensurePageChannelsHandler } from '@/endpoints/ensure-page-channels'
import { verifyOnboardingHandler } from '@/endpoints/verify-onboarding'
import { ensureFoundersHandler } from '@/endpoints/ensure-founders'
import { dbRepairLocksHandler } from '@/endpoints/db-repair-locks'
import { dbRepairSequencesHandler } from '@/endpoints/db-repair-sequences'
import { ensureTenantHeroColumnsHandler } from '@/endpoints/ensure-tenant-hero-columns'
import { ensureTokenTablesHandler } from '@/endpoints/ensure-token-tables'
import { ensureServicesTableHandler } from '@/endpoints/ensure-services-table'
import { ensurePresenceTableHandler } from '@/endpoints/ensure-presence-table'
import { reportMessageHandler } from '@/endpoints/report-message'
import { healStalledMessagesHandler } from '@/endpoints/heal-stalled-messages'
import { accountDeletionRequestHandler } from '@/endpoints/account-deletion-request'
import { ensureWorksTableHandler } from '@/endpoints/ensure-works-table'
import { toolMetricsHandler } from '@/endpoints/tool-metrics'
import { fundFloatHandler } from '@/endpoints/fund-float'
import { walletBalanceHandler } from '@/endpoints/wallet-balance'
import { clockHandler, addCostHandler, finalizeHandler } from '@/endpoints/booking-work-session'
import { tenantDoctorHandler } from '@/endpoints/tenant-doctor'
import { setMembershipHandler } from '@/endpoints/set-membership'
import { setMediaHandler } from '@/endpoints/set-media'
import { resolveEditHandler } from '@/endpoints/resolve-edit'
import { ensurePagesNavColumnsHandler } from '@/endpoints/ensure-pages-nav-columns'
import { dmRosterHandler } from '@/endpoints/dm-roster'
import { markReadHandler, unreadHandler } from '@/endpoints/chat-read-state'
import { navRepairHandler } from '@/endpoints/nav-repair'
import { signConstitutionAllHandler } from '@/endpoints/sign-constitution-all'
import { signCaptureHandler } from '@/endpoints/sign-capture'
import { contactSellerHandler } from '@/endpoints/contact-seller'
import { ensureCommunitySpaceHandler } from '@/endpoints/ensure-community-space'
import { foldDmsHandler } from '@/endpoints/fold-dms'
import { unifyDmsHandler } from '@/endpoints/unify-dms'
import { ensureSignaturesTableHandler } from '@/endpoints/ensure-signatures-table'
import { ensureFormSignatureBlockHandler } from '@/endpoints/ensure-form-signature-block'
import { churchTemplateHandler } from '@/endpoints/church-template'
import { fitnessTemplateHandler } from '@/endpoints/fitness-template'
import { marketVendorTemplateHandler } from '@/endpoints/market-vendor-template'
import { linkMarketHandler } from '@/endpoints/link-market'
import { ticketSubmitHandler } from '@/endpoints/tickets-ops'
import { nodeRegisterHandler, nodeListHandler, nodeTelemetryHandler, nodeChatPostHandler, nodeChatGetHandler, nodeMediaHandler, nodeMediaListHandler, nodeFilesPostHandler, nodeFilesGetHandler, nodeFileProxyHandler, aiBrokerResolveHandler, nodeUsageHandler, nodeDispatchHandler } from '@/endpoints/node-ops'
import { policyPagesHandler } from '@/endpoints/policy-pages'
import { pagesFromSpecHandler } from '@/endpoints/pages-from-spec'
import { membershipCheckoutHandler } from '@/endpoints/membership-checkout'
import { myMembershipsHandler, membershipPortalHandler } from '@/endpoints/membership-self'
import { ensureMembershipBlockTablesHandler } from '@/endpoints/ensure-membership-block-tables'
import { ensureMerlinBlockTablesHandler } from '@/endpoints/ensure-merlin-block-tables'
import { ensureGalleryBlockTablesHandler } from '@/endpoints/ensure-gallery-block-tables'
import { ensureLockedDocsRelsHandler } from '@/endpoints/ensure-locked-docs-rels'
import { membershipPlansHandler } from '@/endpoints/membership-plans'
import { membershipReadinessHandler } from '@/endpoints/membership-readiness'
import { workProgressHandler } from '@/endpoints/work-progress'
import { ensureMembershipsTableHandler } from '@/endpoints/ensure-memberships-table'
import { ensureSettingsTableHandler } from '@/endpoints/ensure-settings-table'
import { accountAuditHandler } from '@/endpoints/account-audit'
import { contactFormRepairHandler } from '@/endpoints/contact-form-repair'
import { bookingInfraRepairHandler } from '@/endpoints/booking-infra-repair'
import { endeavorListHandler } from '@/endpoints/endeavor-list'
import { bookingCheckoutHandler } from '@/endpoints/booking-checkout'
import { bookingConfirmHandler } from '@/endpoints/booking-confirm'
import { orderClaimHandler } from '@/endpoints/order-claim'
import { orderCancelHandler } from '@/endpoints/order-cancel'
import { makerOpportunitiesHandler } from '@/endpoints/maker-opportunities'
import { stripeConnectOnboardHandler } from '@/endpoints/stripe-connect-onboard'
import { stripeConnectCallbackHandler } from '@/endpoints/stripe-connect-callback'
import { stripeConnectDashboardHandler } from '@/endpoints/stripe-connect-dashboard'
import { stripeConnectDisconnectHandler } from '@/endpoints/stripe-connect-disconnect'
import { stripeWebhooksHandler } from '@/endpoints/stripe-webhooks'
import { donationCreateIntentHandler } from '@/endpoints/donation-create-intent'
import { donationRoutingHandler } from '@/endpoints/donation-routing'
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
import { eventsCompleteCronHandler } from '@/endpoints/events-complete-cron'
import { emailPollHandler } from '@/endpoints/email-poll'
import { youtubePollHandler } from '@/endpoints/youtube-poll'
import { notificationsPollHandler } from '@/endpoints/notifications-poll'
import { federationPingHandler } from '@/endpoints/federation-ping'
import { federationHeartbeatHandler } from '@/endpoints/federation-heartbeat'
import { federationHeartbeatCronHandler } from '@/endpoints/federation-heartbeat-cron'
import { CRON_QUEUE, cronTasks } from '@/jobs/cronTasks'
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
import { getServerSideURL } from '@/utilities/getURL'
import { authFederatedHandler } from '@/endpoints/auth-federated'
import { addressBookListHandler, addressBookAllHandler } from '@/endpoints/address-book'
import { channelMediaHandler } from '@/endpoints/channel-media'
import { authSystemTokenHandler } from '@/endpoints/auth-system-token'
import { authRequestOtpHandler } from '@/endpoints/auth-request-otp'
import { authVerifyOtpHandler } from '@/endpoints/auth-verify-otp'
import { mediaR2UploadUrlHandler } from '@/endpoints/media-r2-upload-url'
import { mediaR2RegisterHandler } from '@/endpoints/media-r2-register'
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
  // ─── Unified error escalation ───────────────────────────────────────────────
  // Root afterError hook = the single chokepoint where Payload surfaces every
  // admin/API/save error. Routes them all into logError → application-logs +
  // AI Bus `errors` channel + Gotify, so admin save failures stop vanishing
  // into a generic toast. See src/utilities/payloadAfterError.ts.
  hooks: {
    afterError: [afterErrorHook],
  },
  // ─── CORS ─────────────────────────────────────────────────────────────────
  // Allow all origins under *.spacesangels.com and *.kendev.co so tenant
  // subdomains can make credentialed Payload API calls (e.g. /api/users/me).
  // Payload's cors accepts string globs via micromatch.
  // Note: the primary cross-subdomain auth fix is in AuthProvider (uses
  // window.location.origin so calls are same-origin). This is belt-and-suspenders
  // for federation, partner embeds, and any remaining cross-origin fetch paths.
  // Origins are config-driven, not hardcoded — so this same image runs on any
  // node (spacesangels.com = canonical; payloadnuke.com/kendev.co, or a fresh clone) without
  // baking another node's domain into the code. Each node self-allows its own
  // apex + wildcard from NEXT_PUBLIC_SERVER_URL; extra cross-node origins come
  // from CORS_ORIGINS (comma-separated). Native + local-dev origins are the same
  // everywhere (not cross-node coupling) so they stay as constants.
  cors: (() => {
    const fromEnv = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    // This node's own domain, derived from its server URL (apex + subdomains).
    const selfOrigins: string[] = (() => {
      try {
        // getServerSideURL, not NEXT_PUBLIC_SERVER_URL directly: this image is
        // built by Docker, and a Docker build sees only declared ARGs — never the
        // host's service vars. So NEXT_PUBLIC_SERVER_URL can never bake here no
        // matter what the operator sets, and this node would silently allow no
        // origins of its own. SERVER_URL is read at runtime and does work.
        const host = new URL(getServerSideURL()).hostname
        if (!host || host === 'localhost') return []
        const apex = host.split('.').slice(-2).join('.')
        return [`https://${apex}`, `https://*.${apex}`]
      } catch {
        return []
      }
    })()

    // Native clients (Nimue / Capacitor WebView) — bearer-token auth, no cookies,
    // so safe on every node; lets the native app use standard fetch (multipart +
    // SSE) instead of the CapacitorHttp CORS-bypass that mangles binary bodies.
    const nativeOrigins = [
      'https://localhost',
      'http://localhost',
      'capacitor://localhost',
      'ionic://localhost',
    ]

    // Local dev: Core :3000/:3001, Nimue browser-dev :3002, preview harness :3097.
    const devOrigins =
      process.env.NODE_ENV !== 'production'
        ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3097']
        : []

    return Array.from(new Set([...fromEnv, ...selfOrigins, ...nativeOrigins, ...devOrigins]))
  })(),
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
      beforeNav: [
        '@/components/AdminReturnBar#AdminReturnBar',
        '@/components/EnvBanner#EnvBanner',
        '@/components/TenantAutoSelector#TenantAutoSelector',
      ],
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
    SiteVisits,
    Reviews,
    Endeavors,
    FederationPeers,
    Connectors,
    Contacts,
    Partners,
    Tickets,
    Sequences,
    SequenceEnrollments,
    Redirects,
    FederationAuditLog,
    AgentTransactions,
    MediaMeta,
    StreetSigns,
    Quests,
    QuestParticipations,
    TokenLedger,
    Wallets,
    Signatures,
    Memberships,
    Services,
    Works,
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
      // SSL for the PgBouncer pooler cutover. Gated on DATABASE_SSL so this is a NO-OP
      // until that env var is set → safe to merge ahead of the cutover. The pooler
      // terminates TLS with a SELF-SIGNED cert (CN=74.208.87.243, :6432), which
      // node-postgres rejects by default; rejectUnauthorized:false is correct here —
      // the cert is self-signed and the only public leg is Vercel→pooler (the
      // pooler→Postgres hop is loopback on the same box). At cutover IONOS flips
      // DATABASE_URI→:6432 and DATABASE_SSL=require together.
      ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined,
      // Drizzle schema introspection fires many concurrent queries at startup.
      // Remote PostgreSQL needs more headroom than a local DB.
      //
      // HISTORY: max was clamped to 2 on Vercel as a PRE-POOLER mitigation — when the
      // apps connected DIRECT to Postgres (:5432), each warm lambda held `max` real
      // backend connections and ~34 instances × 3 pegged the 100-cap (kendev outage
      // 2026-06-20). That math no longer applies: prod now connects through the
      // pgBouncer pooler (transaction mode, verified 260621 — all backend conns are
      // 127.0.0.1, cl_waiting=0). pgBouncer multiplexes many client connections onto
      // ≤ max_db_connections=35 backends, so the app `max` is now a CLIENT-side count
      // against max_client_conn=2000, not a backend count against the 100-cap.
      //
      // ⚠️ max:2 became the ACTIVE BUG: a Payload admin save holds a transaction on one
      // pool connection; any save-path hook/access-check that runs a query WITHOUT
      // passing `req` (see docs/architecture/PASS_REQ_RULE.md) grabs a SEPARATE pool
      // connection, and the doc-lock check needs another — with max:2 the third query
      // waits the full connectionTimeoutMillis (30s) for a slot that never frees →
      // "Failed query" / 34s autosave hang. Raising max gives each lambda enough
      // connections to stop self-deadlocking; the pooler still protects the backend.
      max: process.env.VERCEL ? 10 : 10, // pooler multiplexes → safe; was 2 (self-starved admin saves)
      idleTimeoutMillis: process.env.VERCEL ? 5_000 : 10_000, // release idle conns fast on serverless to free the shared cap
      connectionTimeoutMillis: 30_000, // 30s — remote DB needs more time during schema pull
      allowExitOnIdle: true,
    },
  }),
  onInit: async (payload) => {
    // An IDLE pooled client whose backend connection the server kills (e.g.
    // idle-in-transaction timeout 25P03 through PgBouncer) emits 'error' on the
    // pg Pool. With no listener node treats it as an uncaughtException and the
    // whole lambda DIES mid-request (observed: /dashboard fatals on kendev,
    // 260704). Active queries are unaffected — they reject normally. Listen and
    // log so a reaped connection is a warning, not an outage.
    const pool = (payload.db as unknown as { pool?: { on?: (ev: 'error', fn: (e: Error) => void) => void } }).pool
    pool?.on?.('error', (err) => {
      payload.logger?.warn?.(`[pg-pool] idle client error (connection reaped, not fatal): ${err.message}`)
    })
  },
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
        // Channels + messages OPT OUT of the plugin's tenant access-AND
        // (useTenantAccess:false keeps the tenant field + admin list filter).
        // Their own access is the real gate — PermissionService's space
        // visibility resolver is already tenant-membership-scoped internally,
        // and two designed features are tenant-TRANSCENDENT by nature: DM
        // channels/messages (visible to their MEMBERS wherever they live —
        // one thread per conversation across portals) and 'community' spaces
        // (the universal town square). The blunt tenant AND silently hid both
        // from non-super-admins (burned 260713: a merged DM thread showed only
        // the reader's-tenant slice of its history).
        channels: { useTenantAccess: false },
        messages: { useTenantAccess: false },
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
        partners: {},
        tickets: {},
        sequences: {},
        'sequence-enrollments': {},
        redirects: {},
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
        // ─── Site Log (visitor analytics per portal) ──────────
        'site-visits': {},
      } as any,
      userHasAccessToAllTenants: (user) => isSuperAdmin(user as Config['collections']['users'] | null),
      tenantsArrayField: {
        includeDefaultField: true,
        // users.read is open to any signed-in person (see signedInDirectoryRead)
        // so chat can resolve names. Which portals someone belongs to is not
        // part of that: it maps the whole membership graph for anyone who asks.
        arrayFieldAccess: { read: adminOrSelfFieldAccess },
      },
      // Allow users with no tenant (e.g. first user before seed) to appear in the Users list
      useUsersTenantFilter: false,
    }),
    // Media storage: Cloudflare R2 when the R2_* env is set (direct upload + zero
    // egress), else Vercel Blob — see utilities/mediaStorage.ts. Dormant until
    // configured, so this is a no-op change with no R2 env present.
    mediaStoragePlugin,
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
          enabledCollections: ['pages', 'posts', 'products', 'events'],
          fields: ((args: { defaultFields: { name?: string }[] }) => {
            const { defaultFields } = args
            const defaultFieldsWithoutUrl = defaultFields.filter(
              (field: { name?: string }) => !('name' in field && field.name === 'url'),
            )
            // The multi-tenant plugin doesn't scope lexical-injected relationship
            // fields, so the internal-link `doc` picker leaks every tenant's pages.
            // Filter it to the tenant of the document being edited.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const scopedFields = defaultFieldsWithoutUrl.map((field: any) => {
              if (field?.name !== 'doc') return field
              return {
                ...field,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                filterOptions: ({ data }: { data: any }) => {
                  const t = data?.tenant
                  const tenantId = t && typeof t === 'object' ? t.id : t
                  if (tenantId == null) return true
                  return { tenant: { equals: Number(tenantId) } }
                },
              }
            })
            return [
              ...scopedFields,
              {
                name: 'url',
                type: 'text',
                admin: {
                  condition: (ctx: { linkType?: string }) => ctx.linkType !== 'internal',
                },
                label: (ctx: { t: (k: string) => string }) => ctx.t('fields:enterURL'),
                // NOT `required: true`. `admin.condition` only HIDES a field in
                // the UI — it does not exempt it from validation. So an INTERNAL
                // link, which legitimately has no url, failed required-validation
                // on save and blocked the whole document: the page could not be
                // saved until the link was deleted again. Conditional validation
                // is the honest expression of "required, unless internal".
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                validate: (value: unknown, { siblingData, data }: any) => {
                  // Lexical nests link fields, so `linkType` shows up in several
                  // shapes depending on where validation runs. The first attempt
                  // at this only checked two of them, couldn't see the type on an
                  // INTERNAL link, and rejected it — which blocked page saves
                  // exactly like the `required: true` it replaced.
                  const linkType =
                    siblingData?.linkType ??
                    siblingData?.fields?.linkType ??
                    data?.linkType ??
                    data?.fields?.linkType

                  if (linkType === 'internal') return true
                  // Can't tell what kind of link this is — do NOT block the save.
                  // A missing url on a custom link is visible in the editor; an
                  // undiagnosable validation failure is not.
                  if (linkType === undefined) return true

                  return typeof value === 'string' && value.trim().length > 0
                    ? true
                    : 'Enter a URL, or switch the link to Internal link.'
                },
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
    // Works (the Library) — public, read-only, file-based souls for thin clients.
    { path: '/works-ops/list', method: 'get', handler: worksListHandler },
    { path: '/works-ops/get', method: 'get', handler: worksGetHandler },
    // Offline-sync: batch current-checksum manifest so a client diffs its whole cache in one call.
    { path: '/works-ops/checksums', method: 'get', handler: worksChecksumsHandler },
    { path: '/works-ops/import', method: 'get', handler: worksImportHandler },
    // Cross-node replication (syndication Phase 5): pull a Work's content from the hosting peer.
    { path: '/works-ops/pull', method: 'get', handler: worksPullHandler },
    // Daily Bread — deterministic N-verses-a-day reading plan over a book Work.
    { path: '/works-ops/daily', method: 'get', handler: worksDailyHandler },
    // Hippocampus — nightly log consolidation (keep unresolved pain, forget the rest).
    { path: '/tickets-ops/submit', method: 'post', handler: ticketSubmitHandler },
    // Watchdog: a LEO placeholder whose turn died becomes a message that says so.
    { path: '/message-ops/heal-stalled', method: 'get', handler: healStalledMessagesHandler },
    { path: '/message-ops/heal-stalled', method: 'post', handler: healStalledMessagesHandler },
    { path: '/log-ops/consolidate', method: 'get', handler: logConsolidateHandler },
    { path: '/log-ops/consolidate', method: 'post', handler: logConsolidateHandler },
    { path: '/metrics-ops/tools', method: 'get', handler: toolMetricsHandler },
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
    // Public lead capture for sites we don't host (the embed.js widget).
    // Unauthenticated by design — see src/endpoints/capture.ts.
    {
      path: '/capture',
      method: 'post',
      handler: captureHandler,
    },
    // Drip sends run off the heartbeat, not off a browser tab left open.
    { path: '/sequence-ops/tick', method: 'get', handler: sequenceTickHandler },
    { path: '/sequence-ops/tick', method: 'post', handler: sequenceTickHandler },
    {
      path: '/capture',
      method: 'options',
      handler: captureOptionsHandler,
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
      path: '/comment-ops/add',
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
          !['posts', 'products', 'pages', 'events'].includes(parentCollection as string)
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
          collection: parentCollection as 'posts' | 'products' | 'pages' | 'events',
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
      // Teleport — cross-instance tenant move (consolidation primitive). Target
      // side: pulls a tenant's graph from a source node's /api/export-site and
      // (dry-run) reports what would move + readiness. super_admin or ?key=CRON_SECRET.
      path: '/provision-ops/teleport',
      method: 'post',
      handler: teleportImportHandler,
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
    // Delete WITH a destination for the contents. GET returns the plan for the
    // dialog's preview; POST carries it out. @see endpoints/space-delete.ts
    {
      path: '/space-ops/delete',
      method: 'get',
      handler: spaceDeleteHandler,
    },
    {
      path: '/space-ops/delete',
      method: 'post',
      handler: spaceDeleteHandler,
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
    // Public, duration-aware, conflict-aware slots for the booking calendar (no auth).
    {
      path: '/booking-ops/public-slots',
      method: 'post',
      handler: bookingPublicSlotsHandler,
    },
    // Owner-facing weekly hours editor (dashboard) — replaces hand-editing rows.
    {
      path: '/booking-ops/set-hours',
      method: 'post',
      handler: bookingSetHoursHandler,
    },
    // Site Log — visitor reports for the current portal (dashboard).
    {
      path: '/site-log/report',
      method: 'get',
      handler: siteLogReportHandler,
    },
    // Backfill share descriptions on posts written before the auto-fill hook.
    {
      path: '/post-ops/meta-repair',
      method: 'get',
      handler: postMetaRepairHandler,
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
    // "I'll build your site for free" — portal + branding + a five-page starter
    // site in one call, so the demo exists before the prospect is asked to pay.
    {
      path: '/provision-ops/demo-site',
      method: 'post',
      handler: demoSiteHandler,
    },

    {
      path: '/provision-ops/prospect-intake',
      method: 'post',
      handler: prospectIntakeHandler,
    },
    {
      path: '/nav-ops/overrides',
      method: 'get',
      handler: navOverridesGetHandler,
    },
    {
      path: '/nav-ops/overrides',
      method: 'post',
      handler: navOverridesPostHandler,
    },
    // The form that FEEDS demo-site. Both hubs were using the generic contact
    // form for signup, which collects none of what a build actually needs.
    {
      path: '/provision-ops/signup-form',
      method: 'post',
      handler: signupFormSetupHandler,
    },
    // The deprovision half — dry-run by default, execute needs confirmSlug.
    {
      path: '/provision-ops/decommission',
      method: 'post',
      handler: decommissionPortalHandler,
    },
    // Retrieve an existing accept link — minting returns the URL once.
    {
      path: '/provision-ops/invites',
      method: 'get',
      handler: portalInvitesHandler,
    },
    // AI switchboard probe — provider reachability + blob storage (LEO eval loop).
    {
      path: '/provision-ops/ai-status',
      method: 'get',
      handler: aiStatusHandler,
    },
    // Self-serve: a signed-in user claims their own guardian-angel portal (the Nimue
    // download → portal mechanic). Shipped dark behind GUARDIAN_ANGEL_SELF_PROVISION.
    {
      path: '/provision-ops/claim-guardian-angel',
      method: 'post',
      handler: claimGuardianAngelHandler,
    },
    // Designate/create the universal Community space (town square). super_admin.
    {
      path: '/provision-ops/ensure-community-space',
      method: 'post',
      handler: ensureCommunitySpaceHandler,
    },
    // Channel-model fold: re-home DM channels onto the AI Bus, retire DM spaces.
    // super_admin; dry-run by default, {execute:true} to write.
    {
      path: '/provision-ops/fold-dms',
      method: 'post',
      handler: foldDmsHandler,
    },
    // Channel-model fold phase 3: merge per-tenant duplicate DM threads (same
    // deterministic slug) into ONE channel per conversation — a DM is the
    // user's, not a tenant's. super_admin; dry-run by default.
    {
      path: '/provision-ops/unify-dms',
      method: 'post',
      handler: unifyDmsHandler,
    },
    // Read companion: the caller's guardian-angel standing (free tier vs over).
    // Powers the Nimue usage banner + Stripe upsell. Safe for any signed-in user.
    {
      path: '/provision-ops/guardian-angel-status',
      method: 'get',
      handler: guardianAngelStatusHandler,
    },
    {
      path: '/provision-ops/guardian-angel-diagnose',
      method: 'get',
      handler: guardianAngelDiagnoseHandler,
    },
    // The one number to keep positive: platform revenue kept vs. infra cost.
    // super_admin only. Feeds /dashboard/solvency + external monitoring.
    {
      path: '/solvency-ops/snapshot',
      method: 'get',
      handler: solvencySnapshotHandler,
    },
    // Daily "are the dollars still positive?" ping — pushed via the GENERIC
    // escalation layer (medium-agnostic; Gotify is one connector). Vercel cron +
    // CRON_SECRET. @see vercel.json crons.
    {
      path: '/solvency-ops/briefing',
      method: 'get',
      handler: solvencyBriefingHandler,
    },
    // Mutable public address: rename a portal's slug as its endeavor takes shape,
    // preserving the old subdomain as an alias so links already sent keep working.
    {
      path: '/provision-ops/rename-portal-slug',
      method: 'post',
      handler: renamePortalSlugHandler,
    },
    // Paid Guardian Angel subscription (platform-direct) — the usage-overage upsell.
    {
      path: '/provision-ops/guardian-angel-checkout',
      method: 'post',
      handler: guardianAngelCheckoutHandler,
    },
    // Phase 1 (schema-safe): add the is_guardian_angel column BEFORE the field
    // deploys, so tenant reads never reference a missing column. Run per prod DB.
    {
      path: '/provision-ops/ensure-guardian-angel-column',
      method: 'get',
      handler: ensureGuardianAngelColumnHandler,
    },
    // Personal planner: the caller's merged bookings+events+quests timeline.
    {
      path: '/planner-ops/agenda',
      method: 'get',
      handler: personalAgendaHandler,
    },
    // Daily Bread reading progress + streak (Nimue reader: fetch / mark-read / verse dial).
    { path: '/works-ops/daily/progress', method: 'get', handler: dailyBreadProgressHandler },
    { path: '/works-ops/daily/progress', method: 'post', handler: dailyBreadProgressHandler },
    // Active quest routing (Uber-Eats-style): sequence accepted quests from a
    // current position; call again to reroute when a new destination comes on.
    { path: '/dispatch-ops/route', method: 'post', handler: dispatchRouteHandler },
    // User-facing moderation: report a message/author for review.
    {
      path: '/moderation/report',
      method: 'post',
      handler: reportMessageHandler,
    },
    // Account deletion request — routes through the tenant's escalation chain.
    {
      path: '/account/deletion-request',
      method: 'post',
      handler: accountDeletionRequestHandler,
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
    // Idempotent DB self-heal: resync id serial sequences to MAX(id). Restores/
    // teleports copy rows but not sequence position → next INSERT collides on id
    // ("Value must be unique"). This was the checkout/transactions outage.
    {
      path: '/provision-ops/db-repair-sequences',
      method: 'get',
      handler: dbRepairSequencesHandler,
    },
    // Idempotent: add the per-section listing-hero columns to `tenants` ahead of
    // the Payload fields that reference them (Posts/Events/Shop hero images).
    // Runs against the deployment's own DB so each prod DB can be healed by URL.
    {
      path: '/provision-ops/ensure-tenant-hero-columns',
      method: 'get',
      handler: ensureTenantHeroColumnsHandler,
    },
    // Idempotently create the token economy tables (token_ledger, wallets) — prod
    // does not auto-create tables for new collections. Run per node after deploy.
    {
      path: '/provision-ops/ensure-token-tables',
      method: 'get',
      handler: ensureTokenTablesHandler,
    },
    {
      path: '/provision-ops/ensure-services-table',
      method: 'get',
      handler: ensureServicesTableHandler,
    },
    {
      path: '/provision-ops/ensure-presence-table',
      method: 'get',
      handler: ensurePresenceTableHandler,
    },
    {
      path: '/provision-ops/ensure-works-table',
      method: 'get',
      handler: ensureWorksTableHandler,
    },
    // Controlled AT issuance: a super_admin funds a Diocese float (backed).
    {
      path: '/provision-ops/fund-float',
      method: 'post',
      handler: fundFloatHandler,
    },
    // Read side: a holder's token balances + recent ledger (dashboard / Nimue).
    {
      path: '/wallet-ops/balance',
      method: 'get',
      handler: walletBalanceHandler,
    },
    // Metered hourly billing — clock in/out, add costs, finalize the invoice.
    { path: '/booking-ops/clock', method: 'post', handler: clockHandler },
    { path: '/booking-ops/add-cost', method: 'post', handler: addCostHandler },
    { path: '/booking-ops/finalize', method: 'post', handler: finalizeHandler },
    // Read-only tenant ownership diagnosis (which tenant owns header/settings/etc).
    { path: '/provision-ops/tenant-doctor', method: 'get', handler: tenantDoctorHandler },
    // Factory primitive: assign an image to any upload field (logo/coverImage/
    // meta.image/...) from an existing mediaId, a URL, or an AI prompt. POST;
    // super_admin or ?key=CRON_SECRET. Non-destructive.
    { path: '/provision-ops/set-media', method: 'post', handler: setMediaHandler },
    // Map a public path → its Payload admin editor URL (for the "Edit this page"
    // link in the Portal Switcher). GET; logged-in user; read-only.
    { path: '/edit-ops/resolve', method: 'get', handler: resolveEditHandler },
    // Provision Pages nav + nested-docs columns on a prod DB BEFORE the config
    // that references them deploys (else Pages queries error). super_admin or ?key=.
    { path: '/provision-ops/ensure-pages-nav-columns', method: 'get', handler: ensurePagesNavColumnsHandler },
    // Factory primitive: grant a user tenant-scoped access (find-or-create user +
    // active tenant-membership at a role). POST; super_admin or ?key=CRON_SECRET.
    {
      path: '/provision-ops/set-membership',
      method: 'post',
      handler: setMembershipHandler,
    },
    // Virtual DM roster: every tenant member (+ LEO) as a DM marker, channel
    // created lazily on first use. GET; authenticated. ?tenantId=<id>.
    {
      path: '/messages-ops/dm-roster',
      method: 'get',
      handler: dmRosterHandler,
    },
    // Read state: what you have already seen, per channel. mark-read merges one
    // channel's timestamp monotonically; unread counts what arrived after it.
    // Authenticated. See utilities/readState.ts.
    {
      path: '/chat/mark-read',
      method: 'post',
      handler: markReadHandler,
    },
    {
      path: '/chat/unread',
      method: 'get',
      handler: unreadHandler,
    },
    // Backfill missing default nav links onto existing tenants. GET; super_admin or ?key=.
    {
      path: '/provision-ops/nav-repair',
      method: 'get',
      handler: navRepairHandler,
    },
    // Rectify tenants with a null setup.constitutionSignedAt by running the same
    // Ed25519 federation signing flow as the sign_constitution LEO tool.
    // GET; super_admin or ?key=CRON_SECRET. ?tenant=<slug> / ?force=true.
    {
      path: '/provision-ops/sign-constitution-all',
      method: 'get',
      handler: signConstitutionAllHandler,
    },
    // Human e-signature capture (the only writer of the Signatures collection;
    // computes the document checksum + tamper-evidence hash server-side). POST;
    // open to authenticated + anonymous signers. -ops prefix (route-shadowing rule).
    {
      path: '/sign-ops/capture',
      method: 'post',
      handler: signCaptureHandler,
    },
    // "Contact the seller / Email me about this" on a product page — captures a
    // lead into the tenant's inbox (form_submission message + Gotify) without a
    // Form Builder doc. POST; open to anonymous visitors. -ops prefix.
    {
      path: '/contact-ops/seller',
      method: 'post',
      handler: contactSellerHandler,
    },
    // Provision the `signatures` table (+ enums + lock-rel column) on a prod DB
    // BEFORE the config referencing it deploys. GET; super_admin or ?key=.
    {
      path: '/provision-ops/ensure-signatures-table',
      method: 'get',
      handler: ensureSignaturesTableHandler,
    },
    // Provision the forms_blocks_signature table (custom Form Builder block) on a
    // prod DB BEFORE the plugin config referencing it deploys. GET; super_admin or ?key=.
    {
      path: '/provision-ops/ensure-form-signature-block',
      method: 'get',
      handler: ensureFormSignatureBlockHandler,
    },
    // Apply the prototype church template (standard parish pages from existing
    // blocks) to a tenant. POST; super_admin or ?key=. Run on spacesangels.com
    // (angels DB) for real church sites — NOT kendev (commercial).
    {
      path: '/provision-ops/church-template',
      method: 'post',
      handler: churchTemplateHandler,
    },
    // Generic gym/studio template (CrossFit, yoga, Pilates, martial arts): stamps
    // standard pages + seeds recurring membership plans. POST; super_admin or ?key=.
    {
      path: '/provision-ops/fitness-template',
      method: 'post',
      handler: fitnessTemplateHandler,
    },
    // Market-vendor / small-retail template (Hays Cactus Farm reference): stamps
    // Home/Find Us/Guides/About/Contact + fleshed-out posts + product catalog. The
    // seed replicate_site clones to local market vendors. POST; super_admin or ?key=.
    {
      path: '/provision-ops/market-vendor-template',
      method: 'post',
      handler: marketVendorTemplateHandler,
    },
    // Market parent-grouping: link/unlink merchant endeavors under a market parent
    // (settings-bag backed, no schema change). super_admin or ?key=. GET reads children.
    { path: '/provision-ops/link-market', method: 'post', handler: linkMarketHandler },
    { path: '/provision-ops/link-market', method: 'get', handler: linkMarketHandler },
    // Merlin nodes register their catalog UP to their endeavor; Core lists them.
    // Phase 1 of distributed-nodes adoption. super_admin or ?key=.
    { path: '/node-ops/register', method: 'post', handler: nodeRegisterHandler },
    { path: '/node-ops/list', method: 'get', handler: nodeListHandler },
    // CIC telemetry feed — endeavor-member-scoped node roster + vitals + AI-bus activity.
    { path: '/node-ops/telemetry', method: 'get', handler: nodeTelemetryHandler },
    // Merlin Console — talk to a node's local brain over the bus (authed endeavor member).
    { path: '/node-ops/chat', method: 'post', handler: nodeChatPostHandler },
    { path: '/node-ops/chat', method: 'get', handler: nodeChatGetHandler },
    // File bridge — a node submits a file (e.g. camera snapshot) into the endeavor's Media.
    { path: '/node-ops/media', method: 'post', handler: nodeMediaHandler },
    // Screenshots tab — a node's recent submittals.
    { path: '/node-ops/media', method: 'get', handler: nodeMediaListHandler },
    // Directory browser — list a node's SHARED files (dispatch + poll), and the
    // Core-proxy fallback that streams a file when the node has no public tunnel.
    { path: '/node-ops/files', method: 'post', handler: nodeFilesPostHandler },
    { path: '/node-ops/files', method: 'get', handler: nodeFilesGetHandler },
    { path: '/node-ops/file', method: 'get', handler: nodeFileProxyHandler },
    // Intelligence broker (Thread 7) — "who can serve model X?" → provider gateways.
    { path: '/ai-broker/resolve', method: 'get', handler: aiBrokerResolveHandler },
    // Node usage ingestion — a node reports a locally-served inference turn into the
    // Operating-Costs ledger (compute-commons metering; Thread 7 economy addendum).
    { path: '/node-ops/usage', method: 'post', handler: nodeUsageHandler },
    // Generic node dispatch — routes a skill to a Merlin node. Tries tunnel first
    // (real-time direct POST), falls back to bus channel (poll loop).
    { path: '/node-ops/dispatch', method: 'post', handler: nodeDispatchHandler },
    // Standard legal pages (Privacy/Terms/Cookie/Refund) + footer links. POST;
    // super_admin or ?key=. Idempotent — every paying/consent-collecting endeavor.
    {
      path: '/provision-ops/policy-pages',
      method: 'post',
      handler: policyPagesHandler,
    },
    // Generic site provisioner — create pages from a JSON spec (site migration /
    // replicate_site building block). POST; super_admin or ?key=.
    {
      path: '/provision-ops/pages-from-spec',
      method: 'post',
      handler: pagesFromSpecHandler,
    },
    // Recurring memberships/dues (the universal unlock): plans (settings bag),
    // subscription checkout (Connect destination charge + platform fee), and the
    // schema-first Memberships table provisioner. Run checkout on a tenant's own
    // host so dues route to that endeavor.
    { path: '/membership-ops/plans', method: 'get', handler: membershipPlansHandler },
    { path: '/membership-ops/plans', method: 'post', handler: membershipPlansHandler },
    { path: '/membership-ops/readiness', method: 'get', handler: membershipReadinessHandler },
    { path: '/works-ops/progress', method: 'get', handler: workProgressHandler },
    { path: '/works-ops/progress', method: 'post', handler: workProgressHandler },
    { path: '/membership-ops/checkout', method: 'post', handler: membershipCheckoutHandler },
    // Member self-service: view my membership + open the Stripe billing portal.
    { path: '/membership-ops/my', method: 'get', handler: myMembershipsHandler },
    { path: '/membership-ops/portal', method: 'post', handler: membershipPortalHandler },
    {
      path: '/provision-ops/ensure-memberships-table',
      method: 'get',
      handler: ensureMembershipsTableHandler,
    },
    // The Membership page-BLOCK's tables (pages_blocks_membership + _pages_v variant).
    // Net-new block ⇒ new tables; prod has no push, so create them or pages queries
    // fail. Run on any node that adds the Membership block.
    {
      path: '/provision-ops/ensure-membership-block-tables',
      method: 'get',
      handler: ensureMembershipBlockTablesHandler,
    },
    // Net-new Merlin Control block ⇒ new tables; create on BOTH DBs BEFORE registering
    // the block in Pages config (see ensure-merlin-block-tables.ts header).
    {
      path: '/provision-ops/ensure-merlin-block-tables',
      method: 'get',
      handler: ensureMerlinBlockTablesHandler,
    },
    // Net-new Gallery block (+ nested images array) ⇒ new tables; create on BOTH DBs
    // BEFORE the registered block deploys (see ensure-gallery-block-tables.ts header).
    {
      path: '/provision-ops/ensure-gallery-block-tables',
      method: 'get',
      handler: ensureGalleryBlockTablesHandler,
    },
    // Self-heal payload_locked_documents_rels drift (missing <collection>_id columns
    // break every admin save). Re-runnable after any new collection ships.
    {
      path: '/provision-ops/ensure-locked-docs-rels',
      method: 'get',
      handler: ensureLockedDocsRelsHandler,
    },
    // ⚠️ The settings table (SettingService bag: feature flags, election persistence,
    // membership plans) was missing on prod — every settings read/write 500'd.
    { path: '/provision-ops/ensure-settings-table', method: 'get', handler: ensureSettingsTableHandler },
    // READ-ONLY account classification (system/founder/test/member/orphan).
    // GET; super_admin or ?key=. Nothing mutated.
    {
      path: '/provision-ops/account-audit',
      method: 'get',
      handler: accountAuditHandler,
    },
    // Backfill the Form Builder contact form (LEO/AI-Bus hook) onto existing
    // tenants whose /contact is still plain text. GET; super_admin or ?key=.
    {
      path: '/provision-ops/contact-form-repair',
      method: 'get',
      handler: contactFormRepairHandler,
    },
    // Hours + services backfill for portals provisioned before /book had either.
    {
      path: '/provision-ops/booking-infra-repair',
      method: 'get',
      handler: bookingInfraRepairHandler,
    },
    // READ-ONLY: list endeavors + the fields that gate Discovery (networkVisible,
    // tenant, federationId) — diagnose "real portal missing from Discovery".
    {
      path: '/provision-ops/endeavor-list',
      method: 'get',
      handler: endeavorListHandler,
    },
    {
      path: '/booking-ops/checkout',
      method: 'post',
      handler: bookingCheckoutHandler,
    },
    {
      path: '/booking-ops/confirm',
      method: 'post',
      handler: bookingConfirmHandler,
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
    {
      // Public transparency readout: where does a gift on THIS host go?
      path: '/donation-ops/routing',
      method: 'get',
      handler: donationRoutingHandler,
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
    // ─── Close out events whose time has passed (jobs queue, hourly) ───
    {
      path: '/event-ops/complete',
      method: 'get',
      handler: eventsCompleteCronHandler,
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
    // ─── Inbound notifications poll (heartbeat: */5 * * * *) ─────
    // Mirrors inbound push messages (Uptime-Kuma, system alerts) onto the AI
    // Bus, deduped by source message id. The ROUTE is named for what it does;
    // Gotify is the transport that currently carries it, the same way /email/poll
    // isn't called /ionos/poll.
    {
      path: '/notifications/poll',
      method: 'get',
      handler: notificationsPollHandler,
    },
    // The old vendor-named path, kept alive so a cron that fires mid-deploy —
    // or any external caller — doesn't 404 into silence.
    {
      path: '/gotify/poll',
      method: 'get',
      handler: notificationsPollHandler,
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
      path: '/media-ops/analyze',
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
      path: '/auth/federated',
      method: 'post',
      handler: authFederatedHandler,
    },
    {
      path: '/address-book-ops/list',
      method: 'get',
      handler: addressBookListHandler,
    },
    {
      path: '/address-book-ops/all',
      method: 'get',
      handler: addressBookAllHandler,
    },
    {
      path: '/media-ops/channel',
      method: 'get',
      handler: channelMediaHandler,
    },
    {
      // Device direct-upload (large clips past Vercel's ~4.5MB body cap): mint a
      // presigned R2 PUT, then register the doc referencing the uploaded key.
      path: '/media-ops/r2-upload-url',
      method: 'post',
      handler: mediaR2UploadUrlHandler,
    },
    {
      path: '/media-ops/r2-register',
      method: 'post',
      handler: mediaR2RegisterHandler,
    },
    {
      path: '/auth/system-token',
      method: 'post',
      handler: authSystemTokenHandler,
    },
    {
      path: '/auth/request-otp',
      method: 'post',
      handler: authRequestOtpHandler,
    },
    {
      path: '/auth/verify-otp',
      method: 'post',
      handler: authVerifyOtpHandler,
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
  /**
   * Scheduled work. See src/jobs/cronTasks.ts for what runs and why.
   *
   * `autoRun` needs a long-lived process — a Railway container qualifies,
   * serverless does not.
   */
  jobs: {
    access: {
      // Do NOT leave the run endpoint open. Session super_admin, or the same
      // bearer the tasks themselves use.
      run: ({ req }) => {
        const roles = (req.user as { roles?: string[] } | undefined)?.roles || []
        if (roles.includes('super_admin')) return true
        const secret = process.env.CRON_SECRET
        return Boolean(secret && req.headers?.get('authorization') === `Bearer ${secret}`)
      },
    },
    // Opt-in, not opt-out. The local stack is a restore of production, so a
    // laptop that woke up with this on would poll the same mailboxes and send
    // the same drips a second time. Railway sets JOBS_AUTORUN=true.
    //
    // The gate is HERE and not in `shouldAutoRun` because Payload's cron
    // schedules due jobs BEFORE it consults `shouldAutoRun` (payload/dist/
    // index.js `_initializeCrons`) — with only that hook the laptop still queued
    // nine rows on boot and then stopped its own cron. No cron, no rows.
    // Verified 260731 by watching exactly that happen.
    autoRun: () =>
      process.env.JOBS_AUTORUN === 'true' ? [{ cron: '* * * * *', queue: CRON_QUEUE }] : [],
    // `deleteJobOnComplete` left at its default `true` on purpose: 4 tasks every
    // 5 minutes is ~1,200 completed rows a day. Failed jobs are kept regardless —
    // so the table holds exactly the runs worth looking at.
    tasks: cronTasks,
  },
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
