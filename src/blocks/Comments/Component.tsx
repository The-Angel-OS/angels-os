import React from 'react'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { CommentForm } from '@/components/Comments/CommentForm'
import { Star } from 'lucide-react'

import type { CommentsBlock as CommentsBlockProps } from '@/payload-types'

type CommentsBlockComponentProps = CommentsBlockProps & {
  id?: string
  className?: string
  docContext?: { id: number; collection: 'posts' | 'products' }
}

export const CommentsBlock: React.FC<CommentsBlockComponentProps> = async ({
  heading = 'Comments',
  docContext,
}) => {
  if (!docContext) {
    return (
      <div className="container py-8">
        <p className="text-sm text-muted-foreground">
          Comments block requires document context. Add this block to a Post or Product page.
        </p>
      </div>
    )
  }

  const { id: parentId, collection: parentCollection } = docContext
  const showRating = parentCollection === 'products'

  const payload = await getPayload({ config: configPromise })

  const commentsResult = await payload.find({
    collection: 'comments',
    where: {
      and: [
        { 'parent.relationTo': { equals: parentCollection } },
        { 'parent.value': { equals: parentId } },
        { isApproved: { equals: true } },
      ],
    } as any,
    sort: '-createdAt',
    limit: 100,
    depth: 0,
    overrideAccess: false,
  })

  const comments = commentsResult.docs ?? []

  return (
    <div className="container py-12">
      <h2 className="mb-6 text-2xl font-bold">{heading}</h2>

      <div className="space-y-8">
        <CommentForm
          parentId={parentId}
          parentCollection={parentCollection}
          showRating={showRating}
        />

        {comments.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Comments ({comments.length})</h3>
            <ul className="space-y-4">
              {comments.map((comment) => (
                <li
                  key={comment.id}
                  className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-medium">{comment.author}</span>
                    {comment.rating != null && (
                      <span className="flex items-center gap-0.5 text-amber-500">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < (comment.rating ?? 0) ? 'fill-amber-400' : 'text-muted-foreground'
                            }`}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {comment.content}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
