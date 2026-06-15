import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import Link from 'next/link'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

export default async function DashboardMediaPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  const { tenantFilter } = await resolveTenantFromHeaders()

  const media = await payload.find({
    collection: 'media',
    where: tenantFilter,
    limit: 100,
    depth: 0,
    sort: '-createdAt',
    overrideAccess: true,
  })

  // Group by type
  const images = media.docs.filter((m: any) => m.mimeType?.startsWith('image/'))
  const videos = media.docs.filter((m: any) => m.mimeType?.startsWith('video/'))
  const documents = media.docs.filter(
    (m: any) => !m.mimeType?.startsWith('image/') && !m.mimeType?.startsWith('video/'),
  )

  function formatFileSize(bytes: number | undefined): string {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Media Library</h1>
          <p className="text-sm text-muted-foreground">
            {media.totalDocs} file{media.totalDocs !== 1 ? 's' : ''} &middot;{' '}
            {images.length} image{images.length !== 1 ? 's' : ''},{' '}
            {videos.length} video{videos.length !== 1 ? 's' : ''},{' '}
            {documents.length} document{documents.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/admin/collections/media/create"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Upload
        </Link>
      </div>

      {media.totalDocs === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold">Your media library is empty</h3>
          <p className="mb-6 text-sm text-muted-foreground max-w-md mx-auto">
            Upload images, videos, and documents to use across your site. Everything you add here is ready for your pages, posts, and products.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/admin/collections/media/create"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Upload Your First File
            </Link>
            <Link
              href="/dashboard/spaces"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Ask LEO: &quot;Help me organize my media library&quot;
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Images — grid view */}
          {images.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Images ({images.length})
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {images.map((item: any) => (
                  <Link
                    key={item.id}
                    href={`/admin/collections/media/${item.id}`}
                    className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50"
                  >
                    {item.url ? (
                      <img
                        src={item.thumbnailURL || item.url}
                        alt={item.alt || item.filename || ''}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center bg-muted text-2xl">
                        🖼
                      </div>
                    )}
                    <div className="p-2">
                      <p className="truncate text-xs font-medium">
                        {item.filename || 'Untitled'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.width && item.height && `${item.width}x${item.height}`}
                        {item.filesize && ` · ${formatFileSize(item.filesize)}`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Videos — list view */}
          {videos.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Videos ({videos.length})
              </h2>
              <div className="space-y-2">
                {videos.map((item: any) => (
                  <Link
                    key={item.id}
                    href={`/admin/collections/media/${item.id}`}
                    className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg">
                      🎬
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">{item.filename || 'Untitled'}</h3>
                      <p className="text-xs text-muted-foreground">
                        {item.mimeType} {item.filesize && `· ${formatFileSize(item.filesize)}`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Documents — list view */}
          {documents.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Documents ({documents.length})
              </h2>
              <div className="space-y-2">
                {documents.map((item: any) => (
                  <Link
                    key={item.id}
                    href={`/admin/collections/media/${item.id}`}
                    className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg">
                      📎
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">{item.filename || 'Untitled'}</h3>
                      <p className="text-xs text-muted-foreground">
                        {item.mimeType} {item.filesize && `· ${formatFileSize(item.filesize)}`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
