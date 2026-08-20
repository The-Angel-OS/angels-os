import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { tenantBaseUrlFrom } from '@/utilities/resolveTenantBaseUrl'

// FeaturedEndeavorsBlock type will be auto-generated on next `payload generate:types`.
// Until then, define the props manually to match config.ts fields.
type FeaturedEndeavorsBlockProps = {
  heading?: string | null
  subheading?: string | null
  source?: 'recent' | 'manual' | null
  endeavors?: (number | any)[] | null
  maxItems?: number | null
  layout?: 'grid' | 'carousel' | 'featured' | null
  showDescription?: boolean | null
  showRegion?: boolean | null
  blockName?: string | null
  blockType?: 'featuredEndeavors'
}

type Endeavor = {
  id: number
  name: string
  tagline?: string | null
  description?: string | null
  endeavorType?: string | null
  status?: string | null
  logo?: { url?: string; alt?: string } | number | null
  coverImage?: { url?: string; alt?: string } | number | null
  operator?: { name?: string | null } | null
  region?: { city?: string | null; state?: string | null; country?: string | null } | null
  capabilities?: Array<{ skill?: string | null }> | null
  tenant?: { id?: number; slug?: string | null; domain?: string | null } | number | null
  /** Resolved public address of this endeavor's portal. */
  href?: string | null
}

export const FeaturedEndeavorsBlock: React.FC<
  FeaturedEndeavorsBlockProps & {
    id?: string | number
    className?: string
  }
> = async ({
  heading = 'Featured Endeavors',
  subheading,
  source = 'recent',
  endeavors: manualEndeavors,
  maxItems = 5,
  layout = 'grid',
  showDescription = true,
  showRegion = true,
}) => {
  const payload = await getPayload({ config: configPromise })
  let endeavors: Endeavor[] = []

  // NOTE the condition is on `source` ALONE. It used to also require a non-empty
  // list, so "Hand-Picked with nothing picked" fell through to the branch below
  // and published EVERY active endeavor, newest first — which is how a
  // tenant-less row named "Claim" reached the front page on 260809. Picking
  // nothing must show nothing; the empty state below says so out loud.
  if (source === 'manual') {
    // Resolve relationship IDs to full docs. An empty list stays empty.
    const ids = (manualEndeavors ?? []).map((e: any) => (typeof e === 'object' ? e.id : e))
    if (ids.length > 0) {
      const result = await payload.find({
        collection: 'endeavors',
        where: { id: { in: ids } },
        limit: ids.length,
        depth: 1,
        overrideAccess: true,
      })
      // Maintain the manual sort order
      endeavors = ids
        .map((id: number) => result.docs.find((d: any) => d.id === id))
        .filter(Boolean) as Endeavor[]
    }
  } else {
    // Fetch most recent active endeavors
    const result = await payload.find({
      collection: 'endeavors',
      where: { status: { in: ['active', 'forming'] } },
      sort: '-createdAt',
      limit: maxItems || 5,
      depth: 1,
      overrideAccess: true,
    })
    endeavors = result.docs as unknown as Endeavor[]
  }

  // Resolve each card's destination once, here, rather than in the card — a
  // server component cannot look a tenant up mid-render, and `depth: 1` above
  // already populated the tenant relationship, so this costs nothing.
  endeavors = endeavors.map((e) => {
    const t = e.tenant
    const href = t && typeof t === 'object' ? tenantBaseUrlFrom(t) : null
    return { ...e, href }
  })

  if (endeavors.length === 0) {
    return (
      <section className="container py-12">
        <h2 className="mb-4 text-2xl font-bold">{heading}</h2>
        <p className="text-muted-foreground">No endeavors to display yet. The Federation is forming.</p>
      </section>
    )
  }

  // A banner and a badge are different pictures with different jobs, and the old
  // single accessor conflated them: with no cover set it stretched the LOGO across
  // the card as a full-bleed banner, which is how "TART-S" came to fill a card
  // edge to edge with its own middle cropped out.
  const getCoverUrl = (e: Endeavor) =>
    typeof e.coverImage === 'object' && e.coverImage?.url ? e.coverImage.url : null
  const getLogoUrl = (e: Endeavor) =>
    typeof e.logo === 'object' && e.logo?.url ? e.logo.url : null

  const getRegion = (e: Endeavor) => {
    const r = e.region
    if (!r) return null
    const parts = [r.city, r.state, r.country].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  }

  const typeLabels: Record<string, string> = {
    'service-provider': 'Service',
    'retail-commerce': 'Commerce',
    'creator-content': 'Creator',
    'booking-based': 'Booking',
    custom: 'Custom',
  }

  const typeColors: Record<string, string> = {
    'service-provider': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    'retail-commerce': 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    'creator-content': 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    'booking-based': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    custom: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-600 dark:text-green-400',
    forming: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  }

  // --- Layouts ---------------------------------------------------------------

  const resolvedShowDescription = showDescription !== false
  const resolvedShowRegion = showRegion !== false

  if (layout === 'carousel') {
    return (
      <section className="container py-12">
        <SectionHeader heading={heading} subheading={subheading} />
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border">
          {endeavors.map((e) => (
            <EndeavorCard
              key={e.id}
              endeavor={e}
              coverUrl={getCoverUrl(e)}
              logoUrl={getLogoUrl(e)}
              region={resolvedShowRegion ? getRegion(e) : null}
              showDescription={resolvedShowDescription}
              typeLabels={typeLabels}
              typeColors={typeColors}
              statusColors={statusColors}
              className="min-w-[300px] max-w-[350px] snap-start shrink-0"
            />
          ))}
        </div>
      </section>
    )
  }

  if (layout === 'featured' && endeavors.length >= 2) {
    const [hero, ...rest] = endeavors
    return (
      <section className="container py-12">
        <SectionHeader heading={heading} subheading={subheading} />
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Hero card */}
          <div className="lg:row-span-2">
            <EndeavorCard
              endeavor={hero!}
              coverUrl={getCoverUrl(hero!)}
              logoUrl={getLogoUrl(hero!)}
              region={resolvedShowRegion ? getRegion(hero!) : null}
              showDescription={resolvedShowDescription}
              typeLabels={typeLabels}
              typeColors={typeColors}
              statusColors={statusColors}
              isHero
            />
          </div>
          {/* Smaller cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {rest.map((e) => (
              <EndeavorCard
                key={e.id}
                endeavor={e}
                coverUrl={getCoverUrl(e)}
              logoUrl={getLogoUrl(e)}
                region={resolvedShowRegion ? getRegion(e) : null}
                showDescription={resolvedShowDescription}
                typeLabels={typeLabels}
                typeColors={typeColors}
                statusColors={statusColors}
              />
            ))}
          </div>
        </div>
      </section>
    )
  }

  // Default: Grid
  return (
    <section className="container py-12">
      <SectionHeader heading={heading} subheading={subheading} />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {endeavors.map((e) => (
          <EndeavorCard
            key={e.id}
            endeavor={e}
            coverUrl={getCoverUrl(e)}
              logoUrl={getLogoUrl(e)}
            region={resolvedShowRegion ? getRegion(e) : null}
            showDescription={resolvedShowDescription}
            typeLabels={typeLabels}
            typeColors={typeColors}
            statusColors={statusColors}
          />
        ))}
      </div>
    </section>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  heading,
  subheading,
}: {
  heading?: string | null
  subheading?: string | null
}) {
  return (
    <div className="mb-8">
      {heading && <h2 className="text-3xl font-bold">{heading}</h2>}
      {subheading && (
        <p className="mt-2 max-w-2xl text-muted-foreground">{subheading}</p>
      )}
    </div>
  )
}

function EndeavorCard({
  endeavor,
  coverUrl,
  logoUrl,
  region,
  showDescription,
  typeLabels,
  typeColors,
  statusColors,
  isHero,
  className,
}: {
  endeavor: Endeavor
  coverUrl: string | null
  logoUrl: string | null
  region: string | null
  showDescription: boolean
  typeLabels: Record<string, string>
  typeColors: Record<string, string>
  statusColors: Record<string, string>
  isHero?: boolean
  className?: string
}) {
  const typeBadge = endeavor.endeavorType
    ? typeLabels[endeavor.endeavorType] || endeavor.endeavorType
    : null
  const typeColor = endeavor.endeavorType
    ? typeColors[endeavor.endeavorType] || 'bg-muted text-muted-foreground'
    : ''
  const statusBadge = endeavor.status
  const statusColor = endeavor.status
    ? statusColors[endeavor.status] || 'bg-muted text-muted-foreground'
    : ''

  // The whole card is the link. The section above these cards tells the reader to
  // "click any of them and look around" — before this they were inert <article>s,
  // so the one instruction on the page did nothing.
  const Card = endeavor.href ? 'a' : 'article'
  const linkProps = endeavor.href
    ? { href: endeavor.href, target: '_blank' as const, rel: 'noopener noreferrer' }
    : {}

  return (
    <Card
      {...linkProps}
      className={`group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-lg ${endeavor.href ? 'cursor-pointer hover:border-primary/40' : ''} ${className || ''}`}
    >
      {/* Cover BANNER — a wide picture, cropped to fill. Only a real cover image
          belongs here; a logo cropped to a banner is the bug this replaced. */}
      {coverUrl ? (
        <div className={`overflow-hidden bg-muted ${isHero ? 'h-64 sm:h-80' : 'h-40 sm:h-48'}`}>
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      ) : (
        // No cover: a slim tinted strip, so cards in a row still line up instead
        // of some starting with a picture and some with text.
        <div className={`bg-gradient-to-br from-primary/10 to-muted ${isHero ? 'h-24' : 'h-12'}`} />
      )}

      <div className={`p-4 ${isHero ? 'flex-1 p-6' : 'flex-1'}`}>
        {/* Logo BADGE — contained, never cropped, so a wordmark stays readable. */}
        {logoUrl && (
          <div className="mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-background p-1">
            <img
              src={logoUrl}
              alt={`${endeavor.name} logo`}
              className="max-h-full max-w-full object-contain"
              loading="lazy"
            />
          </div>
        )}

        {/* Badges */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {typeBadge && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeColor}`}>
              {typeBadge}
            </span>
          )}
          {statusBadge && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
              {statusBadge.charAt(0).toUpperCase() + statusBadge.slice(1)}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className={`font-bold ${isHero ? 'text-xl' : 'text-lg'}`}>
          {endeavor.name}
        </h3>

        {/* Tagline */}
        {endeavor.tagline && (
          <p className="mt-1 text-sm text-muted-foreground">
            {endeavor.tagline}
          </p>
        )}

        {/* Description */}
        {showDescription && endeavor.description && (
          <p className={`mt-2 text-sm text-muted-foreground ${isHero ? 'line-clamp-4' : 'line-clamp-2'}`}>
            {endeavor.description}
          </p>
        )}

        {/* Operator + Region */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {endeavor.operator?.name && (
            <span className="flex items-center gap-1">
              <span>👤</span>
              {endeavor.operator.name}
            </span>
          )}
          {region && (
            <span className="flex items-center gap-1">
              <span>📍</span>
              {region}
            </span>
          )}
          {endeavor.capabilities && endeavor.capabilities.length > 0 && (
            <span className="flex items-center gap-1">
              <span>⚡</span>
              {endeavor.capabilities.length} skill{endeavor.capabilities.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {endeavor.href && (
          <p className="mt-3 text-sm font-medium text-primary">
            Visit their site →
          </p>
        )}
      </div>
    </Card>
  )
}
