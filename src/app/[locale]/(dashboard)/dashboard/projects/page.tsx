import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'

export default async function DashboardProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  // Resolve tenant
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  let tenantId: number | undefined

  if (tenantSlug) {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = tenants.docs?.[0]?.id
  }
  if (!tenantId) {
    const defaults = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'default' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = defaults.docs?.[0]?.id
  }

  const projects = await payload.find({
    collection: 'projects',
    where: {
      ...(tenantId != null ? { tenant: { equals: tenantId } } : {}),
    },
    limit: 100,
    depth: 1,
    sort: '-createdAt',
    overrideAccess: true,
  })

  const statusColors: Record<string, string> = {
    planning: 'bg-yellow-500 text-black',
    active: 'bg-blue-500 text-white',
    paused: 'bg-orange-500 text-white',
    completed: 'bg-green-500 text-white',
    cancelled: 'bg-red-500 text-white',
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {projects.totalDocs} project{projects.totalDocs !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link
          href="/admin/collections/projects/create"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New Project
        </Link>
      </div>

      {projects.totalDocs === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold">Ready to get organized!</h3>
          <p className="mb-6 text-sm text-muted-foreground max-w-md mx-auto">
            Projects help you track work, collaborate with your team, and keep everything moving forward. Start your first one now.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/admin/collections/projects/create"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Create Your First Project
            </Link>
            <Link
              href="/dashboard/spaces"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Ask LEO: &quot;Help me plan and structure my first project&quot;
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.docs.map((project: any) => {
            const ownerName =
              typeof project.owner === 'object'
                ? project.owner?.name || project.owner?.email
                : null
            const memberCount = Array.isArray(project.members) ? project.members.length : 0

            return (
              <Link
                key={project.id}
                href={`/admin/collections/projects/${project.id}`}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg">
                  {project.icon || '📋'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">
                      {project.title || project.name || 'Untitled'}
                    </h3>
                    {project.status && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[project.status] || 'bg-gray-500 text-white'}`}
                      >
                        {project.status}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {project.description
                      ? typeof project.description === 'string'
                        ? project.description.slice(0, 120)
                        : 'Has description'
                      : 'No description'}
                    {ownerName && ` · ${ownerName}`}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  {memberCount > 0 && <p>{memberCount} member{memberCount !== 1 ? 's' : ''}</p>}
                  <p>
                    {new Date(project.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
