import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'

export default async function DashboardMediaPage({
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

  const media = await payload.find({
    collection: 'media',
    where: {
      ...(tenantId != null ? { tenant: { equals: tenantId } } : {}),
    },
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
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="mb-2 text-lg font-medium">No media uploaded</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Upload images, videos, and documents to your media library.
          </p>
          <Link
            href="/admin/collections/media/create"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Upload File
          </Link>
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
