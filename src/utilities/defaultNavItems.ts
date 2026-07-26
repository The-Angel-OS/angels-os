/**
 * Shared nav item definitions — single source of truth for header/footer nav.
 * Used by seed, createDefaultTenantNavigation, and update-all-nav.
 */

export const navLink = (label: string, url: string, newTab?: boolean) => ({
  link: { type: 'custom' as const, label, url, ...(newTab ? { newTab: true } : {}) },
})

/**
 * Seeded header nav — deliberately just Home.
 *
 * The menu DERIVES itself from what the endeavor actually has: Shop appears
 * when there are published products, Posts when there are posts, Events when
 * one is upcoming, Book when a service is enabled, Join when a membership plan
 * exists, Contact from the pages collection, Donate for giving orgs. Seeding
 * those rows as data made every tenant carry the same six links whether or not
 * they applied — an electrician provisioned with a "Shop" row he will never
 * use — and nothing ever revisited them, so the seed silently outranked the
 * derivation and drifted (Clearwater ended up with two header docs).
 *
 * Home is kept because it is the one item that is true for every portal and
 * anchors the CMS-pages dropdown. Everything else is worked out at render;
 * owners adjust it through nav overrides (hide / pin / inline cap), not by
 * editing a seeded list.
 */
export const DEFAULT_HEADER_NAV = [navLink('Home', '/')]

/** Standard footer nav for all tenants. Donate is appended by the Header for
 * community endeavors; the "Angel OS" community links are a platform-only footer
 * section — neither belongs in the seeded per-tenant footer (cross-barrier leak). */
export const DEFAULT_FOOTER_NAV = [
  navLink('Home', '/'),
  navLink('Posts', '/posts'),
  navLink('Contact', '/contact'),
  navLink('Dashboard', '/dashboard'),
]
