import { setRequestLocale } from 'next-intl/server'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'

export default async function DashboardPostsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })
  const { tenantFilter } = await resolveTenantFromHeaders()

  const posts = await payload.find({
    collection: 'posts',
    where: tenantFilter,
    limit: 100,
    depth: 1,
    sort: '-createdAt',
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
          <h1 className="text-2xl font-bold">Posts</h1>
          <p className="text-sm text-muted-foreground">
            {posts.totalDocs} post{posts.totalDocs !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link
          href="/admin/collections/posts/create"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New Post
        </Link>
      </div>

      {posts.totalDocs === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold">Your blog awaits!</h3>
          <p className="mb-6 text-sm text-muted-foreground max-w-md mx-auto">
            Share your ideas, stories, and updates with the world. Your first post is just a click away.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/admin/collections/posts/create"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Write Your First Post
            </Link>
            <Link
              href="/dashboard/spaces"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Ask LEO: &quot;Help me write an engaging first blog post&quot;
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.docs.map((post: any) => {
            const status = post._status || 'draft'
            const authorName: string | null = null
            const categoryNames = Array.isArray(post.categories)
              ? post.categories
                  .map((c: any) => (typeof c === 'object' ? c.title : null))
                  .filter(Boolean)
              : []
            const heroUrl =
              typeof post.meta?.image === 'object' ? post.meta.image?.url : null

            return (
              <div
                key={post.id}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
              >
                {heroUrl ? (
                  <img
                    src={heroUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg">
                    &#x1F4DD;
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">
                      {post.title || 'Untitled'}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[status] || 'bg-gray-500 text-white'}`}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {authorName && `${authorName} · `}
                    {categoryNames.length > 0 && `${categoryNames.join(', ')} · `}
                    {new Date(post.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {status === 'published' && post.slug && (
                    <Link
                      href={`${prefix}/posts/${post.slug}`}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      View
                    </Link>
                  )}
                  <Link
                    href={`/admin/collections/posts/${post.id}`}
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
