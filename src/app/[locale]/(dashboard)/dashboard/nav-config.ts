/**
 * Data-driven navigation configuration.
 *
 * Defines all sidebar nav sections and items in one place.
 * Both mobile and desktop renderers consume this config,
 * eliminating the duplicated JSX that previously existed.
 */

import type { NavIconKey } from './nav-icons'
import { FEATURES } from '@/config/features'

// ─── Visibility Context ─────────────────────────────────────────

export interface NavVisibilityContext {
  isAuthenticated: boolean
  isAdmin: boolean
  isBusinessOwner: boolean
  wizardComplete: boolean
  permissions: string[]
  tenantRole: string | null
  /** Optional surfaces this portal has switched on — see tenant.features. */
  features?: { works?: boolean | null } | null
}

// ─── Config Types ───────────────────────────────────────────────

export interface NavItemConfig {
  key: string
  label: string
  icon: NavIconKey
  href: (prefix: string) => string
  isActive: (pathname: string, prefix: string) => boolean
  visible: (ctx: NavVisibilityContext) => boolean
  badge?: { text: string; color: string }
  className?: string
}

export interface NavSectionConfig {
  key: string
  label: string
  /** Collapsible sections can be toggled open/closed */
  collapsible: boolean
  items: NavItemConfig[]
  visible: (ctx: NavVisibilityContext) => boolean
}

// ─── Helpers ────────────────────────────────────────────────────

const always = () => true
const authenticated = (ctx: NavVisibilityContext) => ctx.isAuthenticated
const adminOnly = (ctx: NavVisibilityContext) => ctx.isAuthenticated && ctx.isAdmin
const businessOwner = (ctx: NavVisibilityContext) => ctx.isAuthenticated && ctx.isBusinessOwner
const adminOrBusinessOwner = (ctx: NavVisibilityContext) => ctx.isAuthenticated && (ctx.isAdmin || ctx.isBusinessOwner)
/**
 * Works Studio is not a platform feature — it is a per-portal one. On a portal
 * that does not publish Works the Studio was a door onto an empty room, and
 * worse, it advertised a capability their customers would ask about. Now driven
 * by `tenant.features.works` (Endeavor Settings) instead of a slug allow-list.
 */
const worksEndeavorOnly = (ctx: NavVisibilityContext) =>
  ctx.isAuthenticated && Boolean(ctx.features?.works)

/** isActive shorthand — matches if pathname includes the given path segment */
const active = (path: string) => (pathname: string, _prefix: string) => pathname.includes(path)

// ─── Navigation Sections ────────────────────────────────────────

export const NAV_SECTIONS: NavSectionConfig[] = [
  // ── OVERVIEW ──
  {
    key: 'overview',
    label: 'OVERVIEW',
    collapsible: false,
    visible: always,
    items: [
      {
        key: 'home',
        label: 'Home',
        icon: 'home',
        href: (p) => `${p}/`,
        isActive: () => false,
        visible: always,
      },
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: 'grid',
        href: (p) => `${p}/dashboard`,
        isActive: (pn, p) => pn === `${p}/dashboard` || pn === '/dashboard',
        visible: always,
      },
      {
        // Spaces (the AI Bus / Discord-class chat) is the daily driver — promoted
        // to the top of OVERVIEW, right under Dashboard, ahead of My Circles.
        key: 'spaces',
        label: 'Spaces',
        icon: 'bot',
        href: (p) => `${p}/dashboard/spaces`,
        isActive: active('/dashboard/spaces'),
        visible: authenticated,
      },
      {
        key: 'circles',
        label: 'My Circles',
        icon: 'users',
        href: (p) => `${p}/dashboard/circles`,
        isActive: active('/dashboard/circles'),
        visible: authenticated, // the people & endeavors you're part of (Life360++)
      },
      {
        key: 'bridge',
        label: 'Bridge',
        icon: 'helm',
        href: (p) => `${p}/dashboard/bridge`,
        isActive: active('/dashboard/bridge'),
        visible: always, // Public — operational transparency
      },
      {
        key: 'cic',
        label: 'CIC',
        icon: 'radar',
        href: (p) => `${p}/dashboard/cic`,
        isActive: active('/dashboard/cic'),
        visible: always, // Public — command center is the viewport
      },
      {
        key: 'telemetry',
        label: 'Telemetry',
        icon: 'activity',
        href: (p) => `${p}/dashboard/telemetry`,
        isActive: active('/dashboard/telemetry'),
        visible: authenticated, // Merlin node CIC — endeavor-member gated at the API
      },
      {
        key: 'ai-costs',
        label: 'AI Costs',
        icon: 'banknote',
        href: (p) => `${p}/dashboard/ai-costs`,
        isActive: active('/dashboard/ai-costs'),
        visible: adminOrBusinessOwner, // economic data — owners + admins
      },
      {
        key: 'solvency',
        label: 'Solvency',
        icon: 'banknote',
        href: (p) => `${p}/dashboard/solvency`,
        isActive: active('/dashboard/solvency'),
        visible: adminOnly, // platform-wide money view — super_admin (page enforces)
      },
      {
        key: 'payload-admin',
        label: 'Payload Admin',
        icon: 'gear',
        href: (p) => `${p}/admin`,
        isActive: () => false,
        visible: adminOnly,
      },
      {
        key: 'my-orders',
        label: 'My Orders',
        icon: 'shopping-bag',
        href: (p) => `${p}/dashboard/my-orders`,
        isActive: active('/dashboard/my-orders'),
        visible: authenticated,
      },
      {
        key: 'docs',
        label: 'Documentation',
        icon: 'book-open',
        href: (p) => `${p}/dashboard/docs`,
        isActive: active('/dashboard/docs'),
        visible: always,
      },
      {
        key: 'learn',
        label: 'Learn',
        icon: 'sparkle',
        href: (p) => `${p}/dashboard/learn`,
        isActive: active('/dashboard/learn'),
        visible: always,
      },
      {
        key: 'changelog',
        label: 'Changelog',
        icon: 'history',
        href: (p) => `${p}/dashboard/changelog`,
        isActive: active('/dashboard/changelog'),
        visible: always, // Public — operational transparency (like Bridge / CIC)
      },
      {
        key: 'federation-network',
        label: 'Federation',
        icon: 'network',
        href: (p) => `${p}/dashboard/federation-network`,
        isActive: active('/dashboard/federation-network'),
        visible: () => FEATURES.federation, // built + demonstrated; off until a real peer joins
        badge: { text: 'Live', color: 'bg-amber-500' },
      },
      {
        key: 'endeavors',
        label: 'Endeavors',
        icon: 'grid',
        href: (p) => `${p}/dashboard/endeavors`,
        isActive: active('/dashboard/endeavors'),
        // Cross-federation directory — dormant behind the flag while we run single-node.
        visible: (ctx) => FEATURES.endeavorBrowser && ctx.isAuthenticated,
      },
      // Retired 260714: the 17-min conversational "Enterprise Setup" wizard was
      // one of THREE overlapping setup surfaces. Creation now goes through the
      // fast ProvisionWizard (/dashboard/admin/provision), ongoing config through
      // Settings. /dashboard/setup redirects to /dashboard.
    ],
  },

  // ── ACCOUNT ──
  {
    key: 'account',
    label: 'ACCOUNT',
    collapsible: false,
    visible: authenticated,
    items: [
      {
        key: 'profile',
        label: 'Profile',
        icon: 'user',
        href: (p) => `${p}/dashboard/account`,
        isActive: (pn, p) => pn === `${p}/dashboard/account` || pn === '/dashboard/account',
        visible: always,
      },
      {
        // Enterprise integrations (Email, WhatsApp, Stripe, Gotify…). Distinct
        // from "Connections" (personal OAuth sign-ins). Owners self-serve their
        // own tenant's integrations; access is enforced on the Connectors
        // collection (tenant_admin / tenant_manager / super_admin).
        key: 'integrations',
        label: 'Integrations',
        icon: 'plug',
        href: (p) => `${p}/dashboard/account/integrations`,
        isActive: active('/dashboard/account/integrations'),
        visible: adminOrBusinessOwner,
      },
      {
        key: 'addresses',
        label: 'Addresses',
        icon: 'map-pin',
        href: (p) => `${p}/dashboard/account/addresses`,
        isActive: active('/dashboard/account/addresses'),
        visible: always,
      },
    ],
  },

  // ── PEOPLE ──
  // Promoted out of ADMIN so the member/user manager + CRM are discoverable
  // (no more digging into Payload admin). "People" = members of the current
  // portal/endeavor (tenant-memberships); "Contacts" = leads/CRM.
  {
    key: 'people',
    label: 'PEOPLE',
    collapsible: true,
    visible: adminOrBusinessOwner,
    items: [
      {
        key: 'people-members',
        label: 'People',
        icon: 'users',
        href: (p) => `${p}/dashboard/admin/team`,
        isActive: active('/dashboard/admin/team'),
        visible: always,
      },
      {
        key: 'people-contacts',
        label: 'Contacts',
        icon: 'book-open',
        href: (p) => `${p}/dashboard/admin/contacts`,
        isActive: active('/dashboard/admin/contacts'),
        visible: always,
      },
      {
        key: 'people-invitations',
        label: 'Invitations',
        icon: 'mail',
        href: (p) => `${p}/dashboard/admin/invitations`,
        isActive: active('/dashboard/admin/invitations'),
        visible: always,
      },
      {
        // Moved out of ADMIN — crew (the Endeavor's "muster roll") is a People
        // concern. Route unchanged (/dashboard/admin/crew) so existing links hold.
        key: 'crew',
        label: 'Crew',
        icon: 'anchor',
        href: (p) => `${p}/dashboard/admin/crew`,
        isActive: active('/dashboard/admin/crew'),
        visible: always,
      },
    ],
  },

  // ── BUSINESS OPS ──
  {
    key: 'business-ops',
    label: 'BUSINESS OPS',
    collapsible: true,
    visible: businessOwner,
    items: [
      {
        key: 'products',
        label: 'Products',
        icon: 'cube',
        href: (p) => `${p}/dashboard/products`,
        isActive: active('/dashboard/products'),
        visible: always,
      },
      {
        key: 'services',
        label: 'Services',
        icon: 'calendar',
        href: (p) => `${p}/dashboard/services`,
        isActive: active('/dashboard/services'),
        visible: always,
      },
      {
        key: 'quests',
        label: 'Quests',
        icon: 'clipboard',
        href: (p) => `${p}/dashboard/quests`,
        isActive: active('/dashboard/quests'),
        visible: always,
      },
      {
        key: 'orders',
        label: 'Orders',
        icon: 'clipboard',
        href: (p) => `${p}/dashboard/orders`,
        isActive: active('/dashboard/orders'),
        visible: always,
      },
      {
        key: 'events',
        label: 'Events',
        icon: 'calendar-event',
        href: (p) => `${p}/dashboard/events`,
        isActive: active('/dashboard/events'),
        visible: always,
      },
      {
        key: 'appointments',
        label: 'Appointments',
        icon: 'calendar',
        href: (p) => `${p}/dashboard/appointments`,
        isActive: active('/dashboard/appointments'),
        visible: always,
      },
      {
        key: 'tickets',
        label: 'Tickets',
        icon: 'calendar',
        href: (p) => `${p}/dashboard/tickets`,
        isActive: active('/dashboard/tickets'),
        visible: always,
      },
      {
        key: 'holon',
        label: 'Holon Node',
        icon: 'holon',
        href: (p) => `${p}/dashboard/holon`,
        isActive: active('/dashboard/holon'),
        visible: always,
      },
    ],
  },

  // ── PRODUCTIVITY ──
  {
    key: 'productivity',
    label: 'PRODUCTIVITY',
    collapsible: true,
    visible: businessOwner,
    items: [
      {
        key: 'projects',
        label: 'Projects',
        icon: 'folder',
        href: (p) => `${p}/dashboard/projects`,
        isActive: active('/dashboard/projects'),
        visible: always,
      },
      {
        key: 'availability',
        label: 'Availability',
        icon: 'clock',
        href: (p) => `${p}/dashboard/availability`,
        isActive: active('/dashboard/availability'),
        visible: always,
      },
    ],
  },

  // ── CONTENT ──
  {
    key: 'content',
    label: 'CONTENT',
    collapsible: true,
    visible: businessOwner,
    items: [
      {
        key: 'pages',
        label: 'Pages',
        icon: 'file',
        href: (p) => `${p}/dashboard/pages`,
        isActive: active('/dashboard/pages'),
        visible: always,
      },
      {
        key: 'posts',
        label: 'Posts',
        icon: 'article',
        href: (p) => `${p}/dashboard/posts`,
        isActive: active('/dashboard/posts'),
        visible: always,
      },
      {
        key: 'media-lib',
        label: 'Media',
        icon: 'image',
        href: (p) => `${p}/dashboard/media`,
        isActive: active('/dashboard/media'),
        visible: always,
      },
      {
        key: 'comments',
        label: 'Comments',
        icon: 'comment',
        href: (p) => `${p}/dashboard/admin/comments`,
        isActive: active('/dashboard/admin/comments'),
        visible: always,
      },
      {
        key: 'works',
        label: 'Works Studio',
        icon: 'book-open',
        href: (p) => `${p}/dashboard/works`,
        isActive: active('/dashboard/works'),
        visible: worksEndeavorOnly,
      },
    ],
  },

  // ── ADMIN ──
  {
    key: 'admin',
    label: 'ADMIN',
    collapsible: true,
    visible: adminOnly,
    items: [
      {
        key: 'tenant-admin',
        label: 'Tenant Admin',
        icon: 'shield',
        href: (p) => `${p}/dashboard/admin`,
        isActive: (pn) =>
          pn.includes('/dashboard/admin') &&
          !pn.includes('/dashboard/admin/') /* exact /admin only */,
        visible: always,
        className: 'text-emerald-600 dark:text-emerald-400',
      },
      // Provision (the endeavor wizard) and Suitcase are OFF the sidebar as of
      // 260820 — Ken's call. Both routes still resolve: /dashboard/setup,
      // /dashboard/new-endeavor and /dashboard/endeavor are permanent redirects
      // INTO /dashboard/admin/provision, and LEO links it. It just doesn't earn
      // a standing slot in a nav this long. Re-add here if it needs one back.
      {
        key: 'payments',
        label: 'Payments',
        icon: 'credit-card',
        href: (p) => `${p}/dashboard/admin/payments`,
        isActive: active('/dashboard/admin/payments'),
        visible: always,
      },
      {
        key: 'payouts',
        label: 'Payouts',
        icon: 'banknote',
        href: (p) => `${p}/dashboard/admin/payouts`,
        isActive: active('/dashboard/admin/payouts'),
        visible: always,
      },
      {
        key: 'bookings',
        label: 'Bookings',
        icon: 'calendar-event',
        href: (p) => `${p}/dashboard/admin/bookings`,
        isActive: active('/dashboard/admin/bookings'),
        visible: always,
      },
      {
        key: 'settings',
        label: 'Settings',
        icon: 'gear',
        href: (p) => `${p}/dashboard/admin/settings`,
        isActive: active('/dashboard/admin/settings'),
        visible: always,
      },
      {
        key: 'site-log',
        label: 'Site Log',
        icon: 'activity',
        href: (p) => `${p}/dashboard/admin/site-log`,
        isActive: active('/dashboard/admin/site-log'),
        visible: always,
      },
      {
        key: 'error-logs',
        label: 'Error Logs',
        icon: 'alert',
        href: (p) => `${p}/dashboard/admin/error-logs`,
        isActive: active('/dashboard/admin/error-logs'),
        visible: always,
      },
      {
        key: 'backups',
        label: 'Backups',
        icon: 'history',
        href: (p) => `${p}/dashboard/admin/backups`,
        isActive: active('/dashboard/admin/backups'),
        visible: always,
      },
      {
        key: 'admin-federation',
        label: 'Federation',
        icon: 'federation',
        href: (p) => `${p}/dashboard/admin/federation`,
        isActive: active('/dashboard/admin/federation'),
        visible: always,
      },
    ],
  },
]
