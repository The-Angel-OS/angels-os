import Link from 'next/link'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * "You already have one of these."
 *
 * A signed-in customer landing on a sign-up page is being sold something they
 * own. /get-started is a content block and a request-a-free-site form, so a
 * customer who followed a link back to it was asked to request the site they
 * already have — with no way through to it from that page.
 *
 * Renders only when all three are true: the marketing tenant, a signed-in
 * viewer, and at least one portal to send them to. Anonymous visitors — the
 * people the page is FOR — never see it and pay nothing for it.
 *
 * ponytail: no field, no block, no migration. The condition is entirely
 * derivable, so there is nothing to configure.
 */
export async function AlreadyOnboardedBanner({ tenantSlug }: { tenantSlug?: string | null }) {
  // Only the platform's own marketing pages sell sign-up.
  if (tenantSlug !== 'platform') return null

  let portals: { name: string; href: string }[] = []
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: await headers() })
    if (!user) return null

    const memberships = await payload.find({
      collection: 'tenant-memberships',
      where: { and: [{ user: { equals: user.id } }, { status: { equals: 'active' } }] },
      depth: 2,
      limit: 20,
      // Their own portals. Without this the depth-2 hydration is access-denied
      // and every tenant comes back a bare id — the same bug that emptied the
      // brochure portal switcher on 260821.
      overrideAccess: true,
    })

    portals = (memberships.docs || [])
      .map((m) => (m as { tenant?: unknown }).tenant)
      .filter((t): t is { slug?: string; name?: string; domain?: string; branding?: { siteName?: string } } =>
        Boolean(t && typeof t === 'object'),
      )
      // The marketing tenant is not somewhere to "go back to" — it is here.
      .filter((t) => t.slug && t.slug !== 'platform')
      .map((t) => ({
        name: t.branding?.siteName || t.name || t.slug || 'your site',
        href: `https://${t.domain || `${t.slug}.spacesangels.com`}/dashboard`,
      }))
  } catch {
    // A banner is never worth a 500 on a marketing page.
    return null
  }

  if (!portals.length) return null

  return (
    <aside className="container my-8">
      <div className="rounded-lg border border-border bg-card p-5 text-card-foreground">
        <p className="font-medium">You&apos;re already set up.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {portals.length === 1
            ? 'Pick up where you left off:'
            : 'Pick up where you left off on any of these:'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {portals.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {p.name} &rarr;
            </Link>
          ))}
        </div>
      </div>
    </aside>
  )
}
