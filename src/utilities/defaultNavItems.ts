/**
 * Shared nav item definitions — single source of truth for header/footer nav.
 * Used by seed, createDefaultTenantNavigation, and update-all-nav.
 */

export const navLink = (label: string, url: string, newTab?: boolean) => ({
  link: { type: 'custom' as const, label, url, ...(newTab ? { newTab: true } : {}) },
})

/** Standard header nav for all tenants.
 * NOTE: Donate is NOT seeded here — the Header component appends it for
 * community/ministry endeavors and suppresses it for commercial storefronts
 * (businessType gate). Seeding it in data would leak it onto storefronts. */
export const DEFAULT_HEADER_NAV = [
  navLink('Home', '/'),
  navLink('Shop', '/shop'),
  navLink('Posts', '/posts'),
  navLink('Events', '/events'),
  // Provisioning creates a /contact page — surface it in nav (was the missing link).
  navLink('Contact', '/contact'),
  navLink('Dashboard', '/dashboard'),
]

/** Standard footer nav for all tenants. Donate is appended by the Header for
 * community endeavors; the "Angel OS" community links are a platform-only footer
 * section — neither belongs in the seeded per-tenant footer (cross-barrier leak). */
export const DEFAULT_FOOTER_NAV = [
  navLink('Home', '/'),
  navLink('Posts', '/posts'),
  navLink('Contact', '/contact'),
  navLink('Dashboard', '/dashboard'),
]
