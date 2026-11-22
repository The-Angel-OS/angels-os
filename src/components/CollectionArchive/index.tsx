import React from 'react'

import { InteractivePostGrid } from './InteractivePostGrid'
import type { PostCardData } from './PostCard'
import type { ViewerAccessStanding } from '@/components/memberships/JoinToUnlockModal'

const POSTS_PER_PAGE = 12

export { POSTS_PER_PAGE }

export type CollectionArchiveProps = {
  posts: PostCardData[]
  showCategories?: boolean
  columns?: 3 | 4
  /** Card link prefix — '/posts' for posts, '/products' for products. */
  basePath?: string
  viewerStanding?: ViewerAccessStanding | null
}

export const CollectionArchive: React.FC<CollectionArchiveProps> = ({
  posts,
  showCategories = true,
  columns = 4,
  basePath,
  viewerStanding,
}) => {
  return (
    <InteractivePostGrid
      posts={posts}
      showCategories={showCategories}
      columns={columns}
      basePath={basePath}
      viewerStanding={viewerStanding}
    />
  )
}
