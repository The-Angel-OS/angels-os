import { headers } from 'next/headers'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { checkRole } from '@/access/utilities'

export const dynamic = 'force-dynamic'

/**
 * My Circles — the Life360++ people-first view. A "circle" IS an endeavor (family,
 * friends, company, drum circle — all the same primitive, templated). This lists the
 * endeavors you're an active member of and renders them as PEOPLE, not channels:
 * roster + your role + tap-to-open. Same-node membership query — no federation.
 *
 * v1 = roster + open. Presence/status and location (opt-in, consent-gated) layer on.
 */
const idOf = (v: unknown): string | number | null =>
  v && typeof v === 'object' ? (v as { id: string | number }).id : (v as string | number) ?? null

export default async function MyCirclesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const prefix = locale === 'en' ? '' : `/${locale}`

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect(`${prefix}/dashboard`)
  const uid = (user as { id: string | number }).id
  const isSuperAdmin = checkRole(['super_admin'], user)

  // Reuse the dashboard chooser's tenant resolution so My Circles == the Switch-Tenant
  // list (layout.tsx): super_admins see ALL tenants (incl. the platform root, which has
  // no membership row); everyone else sees tenants they hold an ACTIVE or PENDING
  // membership in. My role per tenant still comes from my membership rows.
  const [allTenantsRes, myMemRes] = await Promise.all([
    isSuperAdmin
      ? payload.find({ collection: 'tenants', limit: 100, depth: 0, overrideAccess: true, sort: 'name' })
      : Promise.resolve(null),
    payload.find({
      collection: 'tenant-memberships',
      where: { and: [{ user: { equals: uid } }, { status: { in: ['active', 'pending'] } }] },
      limit: 200,
      depth: 1,
      overrideAccess: true,
    }),
  ])

  const roleByTenant = new Map<string, string>()
  for (const m of myMemRes.docs as Array<{ tenant: unknown; role?: string }>) {
    const tid = idOf(m.tenant)
    if (tid != null) roleByTenant.set(String(tid), m.role || 'member')
  }

  // The tenant set — each tenant IS a circle. From the same source as the chooser.
  const tenantById = new Map<string, { id: string | number; name: string }>()
  if (isSuperAdmin && allTenantsRes) {
    for (const t of allTenantsRes.docs as Array<{ id: string | number; name?: string }>) {
      tenantById.set(String(t.id), { id: t.id, name: t.name || 'Tenant' })
    }
  } else {
    for (const m of myMemRes.docs as Array<{ tenant: unknown }>) {
      const t = m.tenant as { id?: string | number; name?: string } | number | string
      const tid = idOf(t)
      if (tid != null && !tenantById.has(String(tid))) {
        tenantById.set(String(tid), { id: tid, name: (t && typeof t === 'object' && t.name) || 'Tenant' })
      }
    }
  }
  const tenantIds = [...tenantById.values()].map((t) => t.id)

  // Attach endeavor data (tagline/type) + the member roster per tenant.
  const [endeavors, members] = tenantIds.length
    ? await Promise.all([
        payload.find({ collection: 'endeavors', where: { tenant: { in: tenantIds } }, limit: 200, depth: 1, overrideAccess: true }),
        payload.find({
          collection: 'tenant-memberships',
          where: { and: [{ tenant: { in: tenantIds } }, { status: { equals: 'active' } }] },
          limit: 1000,
          depth: 1,
          overrideAccess: true,
        }),
      ])
    : [{ docs: [] as unknown[] }, { docs: [] as unknown[] }]

  const endeavorByTenant = new Map<string, Record<string, unknown>>()
  for (const e of endeavors.docs as Array<Record<string, unknown>>) {
    const tid = String(idOf(e.tenant))
    if (!endeavorByTenant.has(tid)) endeavorByTenant.set(tid, e)
  }

  const rosterByTenant = new Map<string, Array<{ id: string | number; name: string }>>()
  for (const mm of members.docs as Array<{ tenant: unknown; user: unknown }>) {
    const tid = String(idOf(mm.tenant))
    const u = mm.user as { id?: string | number; name?: string; email?: string } | number | string
    const person =
      u && typeof u === 'object'
        ? { id: u.id ?? '', name: u.name || u.email || 'Member' }
        : { id: u as string | number, name: 'Member' }
    const arr = rosterByTenant.get(tid) || []
    arr.push(person)
    rosterByTenant.set(tid, arr)
  }

  type Circle = {
    id: string | number
    name: string
    tagline: string
    type: string
    myRole: string
    members: Array<{ id: string | number; name: string }>
  }
  const circles: Circle[] = [...tenantById.values()].map((t) => {
    const tid = String(t.id)
    const e = endeavorByTenant.get(tid)
    return {
      id: tid,
      name: (e?.name as string) || t.name,
      tagline: (e?.tagline as string) || '',
      type: (e?.endeavorType as string) || '',
      myRole: roleByTenant.get(tid) || (isSuperAdmin ? 'super_admin' : 'member'),
      members: rosterByTenant.get(tid) || [],
    }
  })

  const initials = (name: string) =>
    name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Circles</h1>
        <p className="text-sm text-muted-foreground">
          The people and endeavors you&apos;re part of{circles.length > 0 && ` · ${circles.length}`}
        </p>
      </div>

      {circles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl">👥</div>
          <h3 className="mb-2 text-lg font-semibold">No circles yet</h3>
          <p className="mb-6 text-sm text-muted-foreground max-w-md mx-auto">
            A circle is a group you share — family, friends, a team, a drum circle. Each one is its own endeavor with its own space; start one and invite your people.
          </p>
          <Link
            href="/dashboard/spaces"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to Spaces
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {circles.map((c) => (
            <div key={c.id} className="flex flex-col rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{c.name}</h3>
                  {c.tagline && <p className="truncate text-xs text-muted-foreground">{c.tagline}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{c.myRole}</span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {c.members.slice(0, 8).map((p) => (
                  <span
                    key={p.id}
                    title={p.name}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground"
                  >
                    {initials(p.name)}
                  </span>
                ))}
                {c.members.length > 8 && (
                  <span className="text-[10px] text-muted-foreground">+{c.members.length - 8}</span>
                )}
                {c.members.length === 0 && <span className="text-[10px] text-muted-foreground">Just you</span>}
              </div>

              <div className="mt-3 flex items-center gap-2 text-[10px]">
                {c.type && <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{c.type}</span>}
                <span className="text-muted-foreground">{c.members.length} {c.members.length === 1 ? 'person' : 'people'}</span>
                <Link href="/dashboard/spaces" className="ml-auto font-medium text-primary hover:underline">
                  Open →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
