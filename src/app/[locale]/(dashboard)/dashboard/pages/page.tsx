import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'

export default async function DashboardPagesPage({
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

  const pages = await payload.find({
    collection: 'pages',
    where: {
      ...(tenantId != null ? { tenant: { equals: tenantId } } : {}),
    },
    limit: 100,
    depth: 0,
    sort: '-updatedAt',
    overrideAccess: true,
  })

  const statusColors: Record<string, string> = {
    published: 'bg-green-500 text-white',
    draft: 'bg-yellow-500 text-black',
  }

  const prefix = locale === 'en' ? '' : `/${locale}`

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pages</h1>
          <p className="text-sm text-muted-foreground">
            {pages.totalDocs} page{pages.totalDocs !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link
          href="/admin/collections/pages/create"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New Page
        </Link>
      </div>

      {pages.totalDocs === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="mb-2 text-lg font-medium">No pages yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Create your first page to build your site.
          </p>
          <Link
            href="/admin/collections/pages/create"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Page
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {pages.docs.map((page: any) => {
            const status = page._status || 'draft'
            return (
              <div
                key={page.id}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg">
                  {page.slug === 'home' ? '🏠' : '📄'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">
                      {page.title || 'Untitled'}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[status] || 'bg-gray-500 text-white'}`}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    /{page.slug || ''}
                    {' · Updated '}
                    {new Date(page.updatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {status === 'published' && page.slug && (
                    <Link
                      href={`${prefix}/${page.slug}`}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      View
                    </Link>
                  )}
                  <Link
                    href={`/admin/collections/pages/${page.id}`}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
