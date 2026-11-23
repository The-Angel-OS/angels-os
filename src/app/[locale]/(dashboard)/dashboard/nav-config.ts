/**
 * Data-driven navigation configuration.
 *
 * Defines all sidebar nav sections and items in one place.
 * Both mobile and desktop renderers (and CommandMenu) consume this config.
 *
 * Creator Studio (~14 core items) is shown to portal managers (`tenant_admin` /
 * `tenant_manager` / platform admins). Internal operator tools live in the
 * collapsed-by-default `PLATFORM OPS` drawer, gated strictly to `super_admin`.
 */

import type { NavIconKey } from './nav-icons'

// ─── Visibility Context ─────────────────────────────────────────

export interface NavVisibilityContext {
  isAuthenticated: boolean
  isAdmin: boolean
  isSuperAdmin?: boolean
  isPortalManager?: boolean
  isBusinessOwner: boolean
  wizardComplete: boolean
  permissions: string[]
  tenantRole: string | null
  /** Optional surfaces this portal has switched on — see tenant.features. */
  features?: { works?: boolean | null; pageComments?: boolean | null } | null
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
  /** Start collapsed unless an item inside is currently active */
  defaultCollapsed?: boolean
  items: NavItemConfig[]
  visible: (ctx: NavVisibilityContext) => boolean
}

// ─── Helpers ────────────────────────────────────────────────────

const always = () => true
const authenticated = (ctx: NavVisibilityContext) => ctx.isAuthenticated
const portalManager = (ctx: NavVisibilityContext) =>
  ctx.isAuthenticated &&
  Boolean(
    ctx.isPortalManager ||
      ctx.isAdmin ||
      ctx.tenantRole === 'tenant_admin' ||
      ctx.tenantRole === 'tenant_manager',
  )
const superAdminOnly = (ctx: NavVisibilityContext) =>
  ctx.isAuthenticated && Boolean(ctx.isSuperAdmin)
/**
 * Works Studio is strictly per-portal opt-in via `tenant.features.works`.
 */
const worksEndeavorOnly = (ctx: NavVisibilityContext) =>
  portalManager(ctx) && Boolean(ctx.features?.works)

/** isActive shorthand — matches if pathname includes the given path segment */
const active = (path: string) => (pathname: string, _prefix: string) => pathname.includes(path)

// ─── Navigation Sections ────────────────────────────────────────

export const NAV_SECTIONS: NavSectionConfig[] = [
  // ── STUDIO ──
  {
    key: 'studio',
    label: 'STUDIO',
    collapsible: false,
    visible: always,
    items: [
      {
        key: 'dashboard',
        label: 'Overview',
        icon: 'grid',
        href: (p) => `${p}/dashboard`,
        isActive: (pn, p) => pn === `${p}/dashboard` || pn === '/dashboard',
        visible: always,
      },
      {
        key: 'spaces',
        label: 'Spaces',
        icon: 'bot',
        href: (p) => `${p}/dashboard/spaces`,
        isActive: active('/dashboard/spaces'),
        visible: authenticated,
      },
      {
        key: 'home',
        label: 'View Site ↗',
        icon: 'home',
        href: (p) => `${p}/`,
        isActive: () => false,
        visible: always,
      },
    ],
  },

  // ── CONTENT ──
  {
    key: 'content',
    label: 'CONTENT',
    collapsible: true,
    visible: portalManager,
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
        label: 'Posts & Videos',
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
        label: 'Works',
        icon: 'book-open',
        href: (p) => `${p}/dashboard/works`,
        isActive: active('/dashboard/works'),
        visible: worksEndeavorOnly,
      },
    ],
  },

  // ── MONETIZE ──
  {
    key: 'monetize',
    label: 'MONETIZE',
    collapsible: true,
    visible: portalManager,
    items: [
      {
        key: 'memberships',
        label: 'Memberships',
        icon: 'sparkle',
        href: (p) => `${p}/dashboard/memberships`,
        isActive: active('/dashboard/memberships'),
        visible: always,
      },
      {
        key: 'shop-orders',
        label: 'Shop & Orders',
        icon: 'shopping-bag',
        href: (p) => `${p}/dashboard/products`,
        isActive: (pn) => pn.includes('/dashboard/products') || pn.includes('/dashboard/orders'),
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
        key: 'bookings',
        label: 'Bookings',
        icon: 'calendar',
        href: (p) => `${p}/dashboard/admin/bookings`,
        isActive: (pn) =>
          pn.includes('/dashboard/admin/bookings') ||
          pn.includes('/dashboard/appointments') ||
          pn.includes('/dashboard/availability') ||
          pn.includes('/dashboard/services'),
        visible: always,
      },
    ],
  },

  // ── AUDIENCE ──
  {
    key: 'audience',
    label: 'AUDIENCE',
    collapsible: true,
    visible: portalManager,
    items: [
      {
        key: 'people-members',
        label: 'Members & Team',
        icon: 'users',
        href: (p) => `${p}/dashboard/admin/team`,
        isActive: (pn) =>
          pn.includes('/dashboard/admin/team') || pn.includes('/dashboard/admin/invitations'),
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
    ],
  },

  // ── SETTINGS ──
  {
    key: 'settings',
    label: 'SETTINGS',
    collapsible: false,
    visible: portalManager,
    items: [
      {
        key: 'settings',
        label: 'Settings',
        icon: 'gear',
        href: (p) => `${p}/dashboard/admin/settings`,
        isActive: active('/dashboard/admin/settings'),
        visible: always,
      },
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
        key: 'my-orders',
        label: 'My Orders',
        icon: 'shopping-bag',
        href: (p) => `${p}/dashboard/my-orders`,
        isActive: active('/dashboard/my-orders'),
        visible: always,
      },
      {
        key: 'addresses',
        label: 'Shipping Addresses',
        icon: 'map-pin',
        href: (p) => `${p}/dashboard/account/addresses`,
        isActive: active('/dashboard/account/addresses'),
        visible: always,
      },
      {
        key: 'learn',
        label: 'Learn',
        icon: 'book-open',
        href: (p) => `${p}/dashboard/learn`,
        isActive: active('/dashboard/learn'),
        visible: always,
      },
    ],
  },

  // ── PLATFORM OPS (super_admin only, collapsed by default) ──
  {
    key: 'platform-ops',
    label: 'PLATFORM OPS',
    collapsible: true,
    defaultCollapsed: true,
    visible: superAdminOnly,
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
      {
        key: 'bridge',
        label: 'Bridge',
        icon: 'helm',
        href: (p) => `${p}/dashboard/bridge`,
        isActive: active('/dashboard/bridge'),
        visible: always,
      },
      {
        key: 'cic',
        label: 'CIC',
        icon: 'radar',
        href: (p) => `${p}/dashboard/cic`,
        isActive: active('/dashboard/cic'),
        visible: always,
      },
      {
        key: 'telemetry',
        label: 'Telemetry',
        icon: 'activity',
        href: (p) => `${p}/dashboard/telemetry`,
        isActive: active('/dashboard/telemetry'),
        visible: always,
      },
      {
        key: 'solvency',
        label: 'Solvency',
        icon: 'banknote',
        href: (p) => `${p}/dashboard/solvency`,
        isActive: active('/dashboard/solvency'),
        visible: always,
      },
      {
        key: 'ai-costs',
        label: 'AI Costs',
        icon: 'banknote',
        href: (p) => `${p}/dashboard/ai-costs`,
        isActive: active('/dashboard/ai-costs'),
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
        key: 'crew',
        label: 'Crew',
        icon: 'anchor',
        href: (p) => `${p}/dashboard/admin/crew`,
        isActive: active('/dashboard/admin/crew'),
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
      {
        key: 'docs',
        label: 'Documentation',
        icon: 'book-open',
        href: (p) => `${p}/dashboard/docs`,
        isActive: active('/dashboard/docs'),
        visible: always,
      },
      {
        key: 'changelog',
        label: 'Changelog',
        icon: 'history',
        href: (p) => `${p}/dashboard/changelog`,
        isActive: active('/dashboard/changelog'),
        visible: always,
      },
      {
        key: 'payload-admin',
        label: 'Payload Admin',
        icon: 'gear',
        href: (p) => `${p}/admin`,
        isActive: () => false,
        visible: always,
      },
    ],
  },
]
