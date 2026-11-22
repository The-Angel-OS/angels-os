'use client'

import React, { useEffect, useState } from 'react'

import { PostCard, type PostCardData } from './PostCard'
import {
  isPostLockedForViewer,
  JoinToUnlockModal,
  type ViewerAccessStanding,
} from '@/components/memberships/JoinToUnlockModal'
import { useAuth } from '@/providers/Auth'
import { cn } from '@/utilities/cn'

export interface InteractivePostGridProps {
  posts: PostCardData[]
  showCategories?: boolean
  columns?: 3 | 4
  basePath?: string
  viewerStanding?: ViewerAccessStanding | null
}

/**
 * Client grid rendering PostCards with Patreon-style in-place JoinToUnlockModal
 * interception on locked cards. Zero extra requests for public posts or guests.
 */
export const InteractivePostGrid: React.FC<InteractivePostGridProps> = ({
  posts,
  showCategories = true,
  columns = 4,
  basePath = '/posts',
  viewerStanding,
}) => {
  const { user } = useAuth()
  const [clientStanding, setClientStanding] = useState<ViewerAccessStanding | null>(
    viewerStanding ?? null,
  )
  const [modalTarget, setModalTarget] = useState<{
    post: PostCardData
    thumbnailUrl: string | null
  } | null>(null)

  const hasGatedCards = posts.some((p) => p.access && p.access !== 'public')

  useEffect(() => {
    if (viewerStanding !== undefined) {
      setClientStanding(viewerStanding)
      return
    }
    if (!hasGatedCards) return

    if (!user) {
      setClientStanding({
        isAdmin: false,
        isAuthenticated: false,
        isMember: false,
        inGoodStanding: false,
      })
      return
    }

    const roles = ((user as { roles?: string[] }).roles) || []
    if (roles.some((r) => ['super_admin', 'admin', 'archangel'].includes(r))) {
      setClientStanding({
        isAdmin: true,
        isAuthenticated: true,
        isMember: true,
        inGoodStanding: true,
      })
      return
    }

    let cancelled = false
    fetch('/api/membership-ops/my', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { memberships: [] }))
      .then((d) => {
        if (cancelled) return
        const list = Array.isArray(d?.memberships)
          ? (d.memberships as Array<{ status?: string }>)
          : []
        const active = list.some((m) => m.status === 'active' || m.status === 'trialing')
        const lapsing = active || list.some((m) => m.status === 'past_due')
        setClientStanding({
          isAdmin: false,
          isAuthenticated: true,
          isMember: lapsing,
          inGoodStanding: active,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setClientStanding({
            isAdmin: false,
            isAuthenticated: true,
            isMember: false,
            inGoodStanding: false,
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [viewerStanding, hasGatedCards, user])

  const gridCols =
    columns === 4
      ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className={cn('container')}>
      <div className={cn('grid grid-cols-1 gap-6', gridCols)}>
        {posts?.map((post, index) => {
          const locked = isPostLockedForViewer(post.access, clientStanding)
          const isUnlockedMember = Boolean(post.access && post.access !== 'public' && !locked)
          return (
            <PostCard
              key={post.id ?? post.slug ?? index}
              post={post}
              showCategories={showCategories}
              basePath={basePath}
              locked={locked}
              isUnlockedMember={isUnlockedMember}
              onLockedClick={(clickedPost, thumbUrl) =>
                setModalTarget({ post: clickedPost, thumbnailUrl: thumbUrl })
              }
            />
          )
        })}
      </div>

      {modalTarget && (
        <JoinToUnlockModal
          open
          access={modalTarget.post.access || 'members'}
          targetPath={`${basePath}/${modalTarget.post.slug}`}
          title={String(modalTarget.post.title || '')}
          thumbnailUrl={modalTarget.thumbnailUrl}
          description={
            typeof modalTarget.post.meta?.description === 'string'
              ? modalTarget.post.meta.description
              : null
          }
          onClose={() => setModalTarget(null)}
          onUnlocked={() => setModalTarget(null)}
        />
      )}
    </div>
  )
}
