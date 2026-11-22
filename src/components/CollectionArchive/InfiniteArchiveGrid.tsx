'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { PostCard, type PostCardData } from './PostCard'
import { cn } from '@/utilities/cn'

export interface InfiniteArchiveFeedParams {
  tenantId?: number | string | null
  categoryIds?: Array<number | string>
  q?: string
}

export interface InfiniteArchiveGridProps {
  initialPosts: PostCardData[]
  initialPage: number
  totalPages: number
  totalDocs: number
  limit: number
  columns?: 3 | 4
  showCategories?: boolean
  basePath?: string
  feedParams: InfiniteArchiveFeedParams
}

interface ArchiveFeedResponse {
  docs?: PostCardData[]
  page?: number
  totalPages?: number
  totalDocs?: number
  hasNextPage?: boolean
}

function postKey(post: PostCardData, fallbackIndex: number): string {
  if (post.id !== undefined && post.id !== null) return String(post.id)
  if (post.slug) return post.slug
  return `idx-${fallbackIndex}`
}

export const InfiniteArchiveGrid: React.FC<InfiniteArchiveGridProps> = ({
  initialPosts,
  initialPage,
  totalPages,
  totalDocs,
  limit,
  columns = 3,
  showCategories = true,
  basePath = '/posts',
  feedParams,
}) => {
  const [posts, setPosts] = useState<PostCardData[]>(initialPosts)
  const [currentPage, setCurrentPage] = useState<number>(initialPage)
  const [hasMore, setHasMore] = useState<boolean>(initialPage < totalPages)
  const [totalCount, setTotalCount] = useState<number>(totalDocs)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingRef = useRef<boolean>(false)
  const pageRef = useRef<number>(initialPage)
  const hasMoreRef = useRef<boolean>(initialPage < totalPages)
  const abortRef = useRef<AbortController | null>(null)

  const categoryKey = (feedParams.categoryIds || []).map(String).join(',')

  useEffect(() => {
    abortRef.current?.abort()
    loadingRef.current = false
    pageRef.current = initialPage
    hasMoreRef.current = initialPage < totalPages
    setPosts(initialPosts)
    setCurrentPage(initialPage)
    setHasMore(initialPage < totalPages)
    setTotalCount(totalDocs)
    setLoading(false)
    setError(null)
  }, [initialPosts, initialPage, totalPages, totalDocs, feedParams.tenantId, categoryKey, feedParams.q])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    setError(null)

    const nextPage = pageRef.current + 1
    const sp = new URLSearchParams()
    if (feedParams.tenantId !== undefined && feedParams.tenantId !== null && String(feedParams.tenantId) !== '') {
      sp.set('tenant', String(feedParams.tenantId))
    }
    if (categoryKey) {
      sp.set('categories', categoryKey)
    }
    if (feedParams.q && feedParams.q.trim()) {
      sp.set('q', feedParams.q.trim())
    }
    sp.set('page', String(nextPage))
    sp.set('limit', String(limit))

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/archive-feed?${sp.toString()}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = (await res.json()) as ArchiveFeedResponse
      const incoming = Array.isArray(data.docs) ? data.docs : []

      setPosts((prev) => {
        const seen = new Set(prev.map((p, idx) => postKey(p, idx)))
        const fresh = incoming.filter((p, idx) => !seen.has(postKey(p, idx)))
        return fresh.length > 0 ? [...prev, ...fresh] : prev
      })

      const resolvedPage = typeof data.page === 'number' ? data.page : nextPage
      const nextHasMore =
        typeof data.hasNextPage === 'boolean'
          ? data.hasNextPage
          : resolvedPage < (data.totalPages ?? resolvedPage)

      pageRef.current = resolvedPage
      hasMoreRef.current = nextHasMore
      setCurrentPage(resolvedPage)
      setHasMore(nextHasMore)
      if (typeof data.totalDocs === 'number') {
        setTotalCount(data.totalDocs)
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setError('Could not load more items.')
      }
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [feedParams.tenantId, categoryKey, feedParams.q, limit])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || error) return
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore()
        }
      },
      { rootMargin: '400px 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, error, loadMore, currentPage])

  const gridCols =
    columns === 4
      ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      : 'sm:grid-cols-2 lg:grid-cols-3'

  const showFooter = hasMore || posts.length > limit || Boolean(error)

  return (
    <div className="container">
      <div className={cn('grid grid-cols-1 gap-6', gridCols)}>
        {posts.map((post, index) => (
          <PostCard
            key={postKey(post, index)}
            post={post}
            showCategories={showCategories}
            basePath={basePath}
          />
        ))}
      </div>

      {hasMore && !error && <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />}

      {showFooter && (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{posts.length.toLocaleString()}</span> of{' '}
            <span className="font-medium text-foreground">{Math.max(totalCount, posts.length).toLocaleString()}</span>
          </p>

          {loading && (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading more...
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-destructive">{error}</span>
              <button
                type="button"
                onClick={() => void loadMore()}
                className="rounded-md border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground hover:border-primary/50 hover:bg-muted transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {hasMore && !loading && !error && (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="rounded-md border border-border bg-card px-5 py-2 text-sm font-medium text-foreground hover:border-primary/50 hover:bg-muted transition-colors"
            >
              Load More
            </button>
          )}

          {!hasMore && posts.length > limit && (
            <p className="text-xs text-muted-foreground">
              All {posts.length.toLocaleString()} items loaded
            </p>
          )}
        </div>
      )}
    </div>
  )
}
