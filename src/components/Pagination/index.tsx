'use client'

import {
  Pagination as PaginationComponent,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { cn } from '@/utilities/cn'
import { usePathname } from 'next/navigation'
import React from 'react'

export const Pagination: React.FC<{
  className?: string
  page: number
  totalPages: number
  basePath?: string
}> = (props) => {
  const pathname = usePathname()
  const { className, page, totalPages } = props
  const basePath = props.basePath ?? (pathname.replace(/\/page\/\d+$/, '') || '/posts')

  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1
  const hasExtraPrevPages = page - 1 > 1
  const hasExtraNextPages = page + 1 < totalPages

  const pageUrl = (n: number) => (n === 1 ? basePath : `${basePath}/page/${n}`)

  return (
    <div className={cn('my-12', className)}>
      <PaginationComponent>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href={hasPrevPage ? pageUrl(page - 1) : '#'}
              className={!hasPrevPage ? 'pointer-events-none opacity-50' : undefined}
              tabIndex={hasPrevPage ? undefined : -1}
            />
          </PaginationItem>

          {hasExtraPrevPages && (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          )}

          {hasPrevPage && (
            <PaginationItem>
              <PaginationLink href={pageUrl(page - 1)}>{page - 1}</PaginationLink>
            </PaginationItem>
          )}

          <PaginationItem>
            <PaginationLink href={pageUrl(page)} isActive>
              {page}
            </PaginationLink>
          </PaginationItem>

          {hasNextPage && (
            <PaginationItem>
              <PaginationLink href={pageUrl(page + 1)}>{page + 1}</PaginationLink>
            </PaginationItem>
          )}

          {hasExtraNextPages && (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          )}

          <PaginationItem>
            <PaginationNext
              href={hasNextPage ? pageUrl(page + 1) : '#'}
              className={!hasNextPage ? 'pointer-events-none opacity-50' : undefined}
              tabIndex={hasNextPage ? undefined : -1}
            />
          </PaginationItem>
        </PaginationContent>
      </PaginationComponent>
    </div>
  )
}
