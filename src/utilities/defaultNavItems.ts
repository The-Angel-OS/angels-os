/**
 * Shared nav item definitions — single source of truth for header/footer nav.
 * Used by seed, createDefaultTenantNavigation, and update-all-nav.
 */

export const navLink = (label: string, url: string, newTab?: boolean) => ({
  link: { type: 'custom' as const, label, url, ...(newTab ? { newTab: true } : {}) },
})

/** Standard header nav for all tenants */
export const DEFAULT_HEADER_NAV = [
  navLink('Home', '/'),
  navLink('Shop', '/shop'),
  navLink('Posts', '/posts'),
  navLink('Events', '/events'),
  navLink('Donate', '/donate'),
  navLink('Dashboard', '/dashboard'),
]

/** Standard footer nav for all tenants */
export const DEFAULT_FOOTER_NAV = [
  navLink('Home', '/'),
  navLink('Posts', '/posts'),
  navLink('Donate', '/donate'),
  navLink('Dashboard', '/dashboard'),
  navLink('Angel OS', 'https://github.com/The-Angel-OS/angels-os', true),
]
