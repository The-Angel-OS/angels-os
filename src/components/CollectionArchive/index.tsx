import React from 'react'

import { PostCard, type PostCardData } from './PostCard'
import { cn } from '@/utilities/cn'

const POSTS_PER_PAGE = 12

export { POSTS_PER_PAGE }

export type CollectionArchiveProps = {
  posts: PostCardData[]
  showCategories?: boolean
  columns?: 3 | 4
}

export const CollectionArchive: React.FC<CollectionArchiveProps> = ({
  posts,
  showCategories = true,
  columns = 4,
}) => {
  const gridCols = columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className={cn('container')}>
      <div className={cn('grid grid-cols-1 gap-6', gridCols)}>
        {posts?.map((post, index) => (
          <PostCard
            key={post.id ?? post.slug ?? index}
            post={post}
            showCategories={showCategories}
          />
        ))}
      </div>
    </div>
  )
}
