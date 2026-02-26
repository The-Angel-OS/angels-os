import React from 'react'

export default function Loading() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
      {Array(12)
        .fill(0)
        .map((_, index) => (
          <div key={index} className="space-y-3">
            <div className="aspect-square w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        ))}
    </div>
  )
}
