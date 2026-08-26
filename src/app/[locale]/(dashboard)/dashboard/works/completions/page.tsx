import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { getAvailableWorks } from '@/works/registry'
import { buildCompletionReport } from '@/utilities/trainingCompletion'

export const dynamic = 'force-dynamic'

/**
 * Training completion — who has finished what.
 *
 * The question every employer has and the one thing the training story was
 * missing: you could assign four or five trainings and had no way to see who
 * had done them.
 */
export default async function CompletionsPage({
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

  const { tenant, tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) redirect(`${prefix}/dashboard`)

  // Same authority as the Works Studio: a platform admin, or a tenant_admin /
  // someone with manage_content here. Attendance is staff data.
  if (!checkRole(ADMIN_ROLES, user)) {
    const m = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [{ user: { equals: user.id } }, { tenant: { equals: tenantId } }, { status: { equals: 'active' } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = m.docs?.[0] as { role?: string; permissions?: string[] } | undefined
    const ok =
      doc?.role === 'tenant_admin' ||
      (Array.isArray(doc?.permissions) && doc.permissions.includes('manage_content'))
    if (!ok) redirect(`${prefix}/dashboard`)
  }

  const slug = (tenant as { slug?: string } | null)?.slug ?? null
  const works = (await getAvailableWorks(slug)).map((w) => ({ slug: w.id, title: w.title }))
  const report = await buildCompletionReport(payload, tenantId, works)

  return (
    <div className="mx-auto max-w-5xl py-6">
      <a href={`${prefix}/dashboard/works`} className="text-sm text-muted-foreground hover:underline">
        ← Back to the Library
      </a>
      <h1 className="mt-4 text-xl font-semibold">Training completion</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everyone on {(tenant as { name?: string } | null)?.name || 'this portal'}, and how far
        through each training they are.
      </p>

      {!report.people.length ? (
        <p className="mt-8 text-sm text-muted-foreground">No members yet.</p>
      ) : !report.works.length ? (
        <p className="mt-8 text-sm text-muted-foreground">No trainings published here yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4 font-medium">Person</th>
                {report.works.map((w) => (
                  <th key={w.slug} className="py-2 pr-4 font-medium">
                    {w.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.people.map((p) => (
                <tr key={p.userId} className="border-b border-border/50">
                  <td className="py-2 pr-4">{p.name}</td>
                  {report.works.map((w) => {
                    const v = p.progress[w.slug] ?? 0
                    return (
                      <td key={w.slug} className="py-2 pr-4 tabular-nums">
                        {v >= 100 ? (
                          <span className="text-emerald-600">Complete</span>
                        ) : v > 0 ? (
                          <span className="text-muted-foreground">{v}%</span>
                        ) : (
                          <span className="text-muted-foreground/60">Not started</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
