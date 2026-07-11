import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import Link from 'next/link'
import { requirePortalManager } from '@/utilities/requirePortalManager'
import { resolvePageSize } from '@/utilities/pageSize'
import { ListControls } from '../_components/ListControls'
import { Pager } from '../_components/Pager'

export const dynamic = 'force-dynamic'

const TYPE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'image', label: 'Images' },
  { key: 'video', label: 'Videos' },
  { key: 'document', label: 'Documents' },
]

export default async function DashboardMediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; type?: string; page?: string; limit?: string }>
}) {
  const { locale } = await params
  const { q = '', type = 'all', page: pageParam, limit: limitParam } = await searchParams
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  const { tenantFilter } = await resolveTenantFromHeaders()
  const PAGE_SIZE = resolvePageSize(limitParam)
  const page = Math.max(1, Number(pageParam) || 1)

  // Build the where clause SERVER-side so filtering spans the whole library,
  // not just the current page. tenant scope + type + filename search.
  const and: Where[] = [tenantFilter as Where]
  if (type === 'image') and.push({ mimeType: { like: 'image/' } })
  else if (type === 'video') and.push({ mimeType: { like: 'video/' } })
  else if (type === 'document')
    and.push({ mimeType: { not_like: 'image/' } }, { mimeType: { not_like: 'video/' } })
  if (q.trim()) and.push({ filename: { like: q.trim() } })

  const media = await payload.find({
    collection: 'media',
    where: { and },
    limit: PAGE_SIZE,
    page,
    depth: 0,
    sort: '-createdAt',
    overrideAccess: true,
  })

  function formatFileSize(bytes: number | undefined): string {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const isImage = (m: any) => m.mimeType?.startsWith('image/')
  const isVideo = (m: any) => m.mimeType?.startsWith('video/')

  const start = media.totalDocs === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const end = (page - 1) * PAGE_SIZE + media.docs.length

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Media Library</h1>
          <p className="text-sm text-muted-foreground">
            {media.totalDocs} file{media.totalDocs !== 1 ? 's' : ''}
            {media.totalDocs > 0 && (
              <>
                {' '}&middot; showing {start}–{end}
              </>
            )}
          </p>
        </div>
        <Link
          href="/admin/collections/media/create"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Upload
        </Link>
      </div>

      <ListControls searchPlaceholder="Search by filename…" tabParam="type" tabs={TYPE_TABS} />

      {media.totalDocs === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center">
          <h3 className="mb-2 text-lg font-semibold">
            {q || type !== 'all' ? 'No files match your filters' : 'Your media library is empty'}
          </h3>
          <p className="mb-6 text-sm text-muted-foreground max-w-md mx-auto">
            {q || type !== 'all'
              ? 'Try a different search term or file type.'
              : 'Upload images, videos, and documents to use across your site.'}
          </p>
          {!(q || type !== 'all') && (
            <Link
              href="/admin/collections/media/create"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Upload Your First File
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {media.docs.map((item: any) => (
              <Link
                key={item.id}
                href={`/admin/collections/media/${item.id}`}
                className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50"
              >
                {isImage(item) && item.url ? (
                  <img
                    src={item.thumbnailURL || item.url}
                    alt={item.alt || item.filename || ''}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-muted text-3xl">
                    {isVideo(item) ? '🎬' : '📎'}
                  </div>
                )}
                <div className="p-2">
                  <p className="truncate text-xs font-medium">{item.filename || 'Untitled'}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {isImage(item) && item.width && item.height ? `${item.width}x${item.height}` : item.mimeType}
                    {item.filesize && ` · ${formatFileSize(item.filesize)}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          <Pager page={media.page || 1} totalPages={media.totalPages} />
        </>
      )}
    </div>
  )
}
