import React from 'react'

const defaultCollectionLabels: Record<string, { plural: string; singular: string }> = {
  posts: { plural: 'Posts', singular: 'Post' },
}

export const PageRange: React.FC<{
  className?: string
  collection?: keyof typeof defaultCollectionLabels
  collectionLabels?: { plural?: string; singular?: string }
  currentPage?: number
  limit?: number
  totalDocs?: number
}> = (props) => {
  const {
    className,
    collection,
    collectionLabels: collectionLabelsFromProps,
    currentPage = 1,
    limit = 12,
    totalDocs = 0,
  } = props

  let indexStart = (currentPage - 1) * limit + 1
  if (totalDocs > 0 && indexStart > totalDocs) indexStart = 0

  let indexEnd = currentPage * limit
  if (totalDocs > 0 && indexEnd > totalDocs) indexEnd = totalDocs

  const { plural, singular } =
    collectionLabelsFromProps ||
    (collection ? defaultCollectionLabels[collection] : { plural: 'Items', singular: 'Item' }) ||
    {}

  return (
    <div className={[className, 'text-sm font-medium text-muted-foreground'].filter(Boolean).join(' ')}>
      {totalDocs === 0 && 'No posts found.'}
      {totalDocs > 0 &&
        `Showing ${indexStart}${indexStart > 0 ? ` – ${indexEnd}` : ''} of ${totalDocs} ${
          totalDocs === 1 ? singular : plural
        }`}
    </div>
  )
}
