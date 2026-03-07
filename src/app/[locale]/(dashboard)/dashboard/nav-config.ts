/**
 * Data-driven navigation configuration.
 *
 * Defines all sidebar nav sections and items in one place.
 * Both mobile and desktop renderers consume this config,
 * eliminating the duplicated JSX that previously existed.
 */

import type { NavIconKey } from './nav-icons'

// ─── Visibility Context ─────────────────────────────────────────

export interface NavVisibilityContext {
  isAdmin: boolean
  isBusinessOwner: boolean
  wizardComplete: boolean
  permissions: string[]
  tenantRole: string | null
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
const adminOnly = (ctx: NavVisibilityContext) => ctx.isAdmin
const businessOwner = (ctx: NavVisibilityContext) => ctx.isBusinessOwner
const adminOrBusinessOwner = (ctx: NavVisibilityContext) => ctx.isAdmin || ctx.isBusinessOwner
const includes = (path: string) => (pathname: string) => pathname.includes(path)

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
        key: 'bridge',
        label: 'Bridge',
        icon: 'helm',
        href: (p) => `${p}/dashboard/bridge`,
        isActive: (pn) => pn.includes('/dashboard/bridge'),
        visible: adminOrBusinessOwner,
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
        key: 'spaces',
        label: 'Spaces',
        icon: 'bot',
        href: (p) => `${p}/dashboard/spaces`,
        isActive: (pn) => pn.includes('/dashboard/spaces'),
        visible: always,
      },
      {
        key: 'my-orders',
        label: 'My Orders',
        icon: 'shopping-bag',
        href: (p) => `${p}/dashboard/my-orders`,
        isActive: (pn) => pn.includes('/dashboard/my-orders'),
        visible: always,
      },
      {
        key: 'docs',
        label: 'Documentation',
        icon: 'book-open',
        href: (p) => `${p}/dashboard/docs`,
        isActive: (pn) => pn.includes('/dashboard/docs'),
        visible: always,
      },
      {
        key: 'learn',
        label: 'Learn',
        icon: 'sparkle',
        href: (p) => `${p}/dashboard/learn`,
        isActive: (pn) => pn.includes('/dashboard/learn'),
        visible: always,
      },
      {
        key: 'federation-network',
        label: 'Federation',
        icon: 'network',
        href: (p) => `${p}/dashboard/federation-network`,
        isActive: (pn) => pn.includes('/dashboard/federation-network'),
        visible: always,
        badge: { text: 'Live', color: 'bg-amber-500' },
      },
      {
        key: 'setup',
        label: 'Enterprise Setup',
        icon: 'wand',
        href: (p) => `${p}/dashboard/setup`,
        isActive: (pn) => pn.includes('/dashboard/setup'),
        visible: (ctx) => !ctx.wizardComplete && ctx.isAdmin,
        badge: { text: 'Setup', color: 'bg-primary' },
      },
    ],
  },

  // ── ACCOUNT ──
  {
    key: 'account',
    label: 'ACCOUNT',
    collapsible: false,
    visible: always,
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
        key: 'connections',
        label: 'Connections',
        icon: 'link-chain',
        href: (p) => `${p}/dashboard/account/connections`,
        isActive: (pn) => pn.includes('/dashboard/account/connections'),
        visible: always,
      },
      {
        key: 'addresses',
        label: 'Addresses',
        icon: 'map-pin',
        href: (p) => `${p}/dashboard/account/addresses`,
        isActive: (pn) => pn.includes('/dashboard/account/addresses'),
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
        isActive: (pn) => pn.includes('/dashboard/products'),
        visible: always,
      },
      {
        key: 'orders',
        label: 'Orders',
        icon: 'clipboard',
        href: (p) => `${p}/dashboard/orders`,
        isActive: (pn) => pn.includes('/dashboard/orders'),
        visible: always,
      },
      {
        key: 'events',
        label: 'Events',
        icon: 'calendar-event',
        href: (p) => `${p}/dashboard/events`,
        isActive: (pn) => pn.includes('/dashboard/events'),
        visible: always,
      },
      {
        key: 'appointments',
        label: 'Appointments',
        icon: 'calendar',
        href: (p) => `${p}/dashboard/appointments`,
        isActive: (pn) => pn.includes('/dashboard/appointments'),
        visible: always,
      },
      {
        key: 'holon',
        label: 'Holon Node',
        icon: 'holon',
        href: (p) => `${p}/dashboard/holon`,
        isActive: (pn) => pn.includes('/dashboard/holon'),
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
        isActive: (pn) => pn.includes('/dashboard/projects'),
        visible: always,
      },
      {
        key: 'availability',
        label: 'Availability',
        icon: 'clock',
        href: (p) => `${p}/dashboard/availability`,
        isActive: (pn) => pn.includes('/dashboard/availability'),
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
        isActive: (pn) => pn.includes('/dashboard/pages'),
        visible: always,
      },
      {
        key: 'posts',
        label: 'Posts',
        icon: 'article',
        href: (p) => `${p}/dashboard/posts`,
        isActive: (pn) => pn.includes('/dashboard/posts'),
        visible: always,
      },
      {
        key: 'media-lib',
        label: 'Media',
        icon: 'image',
        href: (p) => `${p}/dashboard/media`,
        isActive: (pn) => pn.includes('/dashboard/media'),
        visible: always,
      },
      {
        key: 'comments',
        label: 'Comments',
        icon: 'comment',
        href: (p) => `${p}/dashboard/admin/comments`,
        isActive: (pn) => pn.includes('/dashboard/admin/comments'),
        visible: always,
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
      {
        key: 'team',
        label: 'Team',
        icon: 'users',
        href: (p) => `${p}/dashboard/admin/team`,
        isActive: (pn) => pn.includes('/dashboard/admin/team'),
        visible: always,
      },
      {
        key: 'endeavor',
        label: 'Endeavor Setup',
        icon: 'wand',
        href: (p) => `${p}/dashboard/endeavor`,
        isActive: (pn) => pn.includes('/dashboard/endeavor'),
        visible: always,
      },
      {
        key: 'provision',
        label: 'Provision',
        icon: 'plus',
        href: (p) => `${p}/dashboard/admin/provision`,
        isActive: () => false,
        visible: always,
      },
      {
        key: 'suitcase',
        label: 'Suitcase',
        icon: 'package',
        href: (p) => `${p}/dashboard/admin/suitcase`,
        isActive: () => false,
        visible: always,
      },
      {
        key: 'payments',
        label: 'Payments',
        icon: 'credit-card',
        href: (p) => `${p}/dashboard/admin/payments`,
        isActive: (pn) => pn.includes('/dashboard/admin/payments'),
        visible: always,
      },
      {
        key: 'payouts',
        label: 'Payouts',
        icon: 'banknote',
        href: (p) => `${p}/dashboard/admin/payouts`,
        isActive: (pn) => pn.includes('/dashboard/admin/payouts'),
        visible: always,
      },
      {
        key: 'bookings',
        label: 'Bookings',
        icon: 'calendar-event',
        href: (p) => `${p}/dashboard/admin/bookings`,
        isActive: (pn) => pn.includes('/dashboard/admin/bookings'),
        visible: always,
      },
      {
        key: 'invitations',
        label: 'Invitations',
        icon: 'mail',
        href: (p) => `${p}/dashboard/admin/invitations`,
        isActive: (pn) => pn.includes('/dashboard/admin/invitations'),
        visible: always,
      },
      {
        key: 'contacts',
        label: 'Contacts',
        icon: 'book-open',
        href: (p) => `${p}/dashboard/admin/contacts`,
        isActive: (pn) => pn.includes('/dashboard/admin/contacts'),
        visible: always,
      },
      {
        key: 'connectors',
        label: 'Connectors',
        icon: 'plug',
        href: (p) => `${p}/dashboard/admin/connectors`,
        isActive: (pn) => pn.includes('/dashboard/admin/connectors'),
        visible: always,
      },
      {
        key: 'settings',
        label: 'Settings',
        icon: 'gear',
        href: (p) => `${p}/dashboard/admin/ai-settings`,
        isActive: (pn) => pn.includes('/dashboard/admin/ai-settings'),
        visible: always,
      },
      {
        key: 'error-logs',
        label: 'Error Logs',
        icon: 'alert',
        href: (p) => `${p}/dashboard/admin/error-logs`,
        isActive: (pn) => pn.includes('/dashboard/admin/error-logs'),
        visible: always,
      },
      {
        key: 'admin-federation',
        label: 'Federation',
        icon: 'federation',
        href: (p) => `${p}/dashboard/admin/federation`,
        isActive: (pn) => pn.includes('/dashboard/admin/federation'),
        visible: always,
      },
    ],
  },
]
