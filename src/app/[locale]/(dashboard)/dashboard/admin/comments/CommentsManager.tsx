'use client'

import React, { useCallback, useEffect, useState, useTransition } from 'react'
import {
  getComments,
  getCommentStats,
  approveComment,
  rejectComment,
  deleteComment,
  bulkApprove,
  bulkDelete,
  type CommentRecord,
  type CommentStats,
} from './actions'

type StatusFilter = 'all' | 'pending' | 'approved'
type ParentFilter = 'all' | 'posts' | 'products'

export default function CommentsManager() {
  const [comments, setComments] = useState<CommentRecord[]>([])
  const [stats, setStats] = useState<CommentStats | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [parentFilter, setParentFilter] = useState<ParentFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [selected, setSelected] = useState<Set<string | number>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadComments = useCallback(() => {
    startTransition(async () => {
      const result = await getComments({
        status: statusFilter,
        parentType: parentFilter,
        search: search || undefined,
        page,
        limit: 25,
      })
      if (result.success) {
        setComments(result.comments)
        setTotalPages(result.totalPages)
        setTotalDocs(result.totalDocs)
      }
    })
  }, [statusFilter, parentFilter, search, page])

  const loadStats = useCallback(() => {
    startTransition(async () => {
      const s = await getCommentStats()
      if (!s.error) setStats(s)
    })
  }, [])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // Clear selection when filters change
  useEffect(() => {
    setSelected(new Set())
  }, [statusFilter, parentFilter, search, page])

  const showMessage = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text })
    setTimeout(() => setActionMessage(null), 3000)
  }

  const handleApprove = useCallback(
    (id: string | number) => {
      startTransition(async () => {
        const result = await approveComment(id)
        if (result.success) {
          showMessage('success', 'Comment approved')
          loadComments()
          loadStats()
        } else {
          showMessage('error', result.error || 'Failed to approve')
        }
      })
    },
    [loadComments, loadStats],
  )

  const handleReject = useCallback(
    (id: string | number) => {
      startTransition(async () => {
        const result = await rejectComment(id)
        if (result.success) {
          showMessage('success', 'Comment rejected')
          loadComments()
          loadStats()
        } else {
          showMessage('error', result.error || 'Failed to reject')
        }
      })
    },
    [loadComments, loadStats],
  )

  const handleDelete = useCallback(
    (id: string | number) => {
      if (!confirm('Permanently delete this comment? This cannot be undone.')) return
      startTransition(async () => {
        const result = await deleteComment(id)
        if (result.success) {
          showMessage('success', 'Comment deleted')
          loadComments()
          loadStats()
        } else {
          showMessage('error', result.error || 'Failed to delete')
        }
      })
    },
    [loadComments, loadStats],
  )

  const handleBulkApprove = useCallback(() => {
    if (selected.size === 0) return
    startTransition(async () => {
      const result = await bulkApprove(Array.from(selected))
      if (result.success) {
        showMessage('success', `Approved ${result.approved} comment${result.approved !== 1 ? 's' : ''}`)
        setSelected(new Set())
        loadComments()
        loadStats()
      } else {
        showMessage('error', result.error || 'Bulk approve failed')
      }
    })
  }, [selected, loadComments, loadStats])

  const handleBulkDelete = useCallback(() => {
    if (selected.size === 0) return
    if (!confirm(`Permanently delete ${selected.size} comment${selected.size !== 1 ? 's' : ''}? This cannot be undone.`))
      return
    startTransition(async () => {
      const result = await bulkDelete(Array.from(selected))
      if (result.success) {
        showMessage('success', `Deleted ${result.deleted} comment${result.deleted !== 1 ? 's' : ''}`)
        setSelected(new Set())
        loadComments()
        loadStats()
      } else {
        showMessage('error', result.error || 'Bulk delete failed')
      }
    })
  }, [selected, loadComments, loadStats])

  const toggleSelect = (id: string | number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === comments.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(comments.map((c) => c.id)))
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max) + '...' : s)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comment Moderation</h1>
          <p className="text-sm text-muted-foreground">
            Review, approve, and manage comments &amp; reviews
          </p>
        </div>
      </div>

      {/* Action message */}
      {actionMessage && (
        <div
          className={`rounded-md px-4 py-2 text-sm ${
            actionMessage.type === 'success'
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400'
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Total" value={stats.total} color="text-foreground" />
          <StatCard label="Pending" value={stats.pending} color="text-yellow-600 dark:text-yellow-400" />
          <StatCard label="Approved" value={stats.approved} color="text-green-600 dark:text-green-400" />
          <StatCard label="Post Comments" value={stats.postComments} color="text-blue-600 dark:text-blue-400" />
          <StatCard label="Product Reviews" value={stats.productReviews} color="text-purple-600 dark:text-purple-400" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as StatusFilter)
            setPage(1)
          }}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
        </select>

        <select
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={parentFilter}
          onChange={(e) => {
            setParentFilter(e.target.value as ParentFilter)
            setPage(1)
          }}
        >
          <option value="all">All Types</option>
          <option value="posts">Post Comments</option>
          <option value="products">Product Reviews</option>
        </select>

        <input
          type="text"
          placeholder="Search author, email, content..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <button
            onClick={handleBulkApprove}
            disabled={isPending}
            className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Approve All
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={isPending}
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete All
          </button>
        </div>
      )}

      {/* Comments list */}
      <div className="rounded-lg border border-border">
        {/* Table header */}
        <div className="hidden border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium uppercase text-muted-foreground sm:grid sm:grid-cols-12 sm:gap-2">
          <div className="col-span-1 flex items-center">
            <input
              type="checkbox"
              checked={comments.length > 0 && selected.size === comments.length}
              onChange={toggleSelectAll}
              className="h-3.5 w-3.5 rounded border-border"
            />
          </div>
          <div className="col-span-2">Author</div>
          <div className="col-span-3">Content</div>
          <div className="col-span-2">Parent</div>
          <div className="col-span-1">Rating</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {isPending && comments.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">Loading...</div>
        ) : comments.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No comments found with the current filters.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {comments.map((comment) => (
              <li key={comment.id} className="px-4 py-3 hover:bg-muted/20">
                {/* Desktop row */}
                <div className="hidden items-center gap-2 sm:grid sm:grid-cols-12">
                  <div className="col-span-1 flex items-center">
                    <input
                      type="checkbox"
                      checked={selected.has(comment.id)}
                      onChange={() => toggleSelect(comment.id)}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm font-medium truncate">{comment.author}</p>
                    <p className="text-xs text-muted-foreground truncate">{comment.email}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</p>
                  </div>
                  <div className="col-span-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">{comment.content}</p>
                  </div>
                  <div className="col-span-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        comment.parentType === 'products'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {comment.parentType === 'products' ? 'Product' : 'Post'}
                    </span>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {truncate(comment.parentTitle, 30)}
                    </p>
                  </div>
                  <div className="col-span-1">
                    {comment.rating != null ? (
                      <span className="text-sm text-amber-500">
                        {'★'.repeat(comment.rating)}
                        <span className="text-muted-foreground">{'★'.repeat(5 - comment.rating)}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="col-span-1">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        comment.isApproved
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                      }`}
                    >
                      {comment.isApproved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    {!comment.isApproved ? (
                      <button
                        onClick={() => handleApprove(comment.id)}
                        disabled={isPending}
                        className="rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-500/10 disabled:opacity-50 dark:text-green-400"
                        title="Approve"
                      >
                        ✓ Approve
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReject(comment.id)}
                        disabled={isPending}
                        className="rounded px-2 py-1 text-xs font-medium text-yellow-600 hover:bg-yellow-500/10 disabled:opacity-50 dark:text-yellow-400"
                        title="Reject"
                      >
                        ✗ Reject
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(comment.id)}
                      disabled={isPending}
                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </div>

                {/* Mobile card */}
                <div className="sm:hidden space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(comment.id)}
                        onChange={() => toggleSelect(comment.id)}
                        className="h-3.5 w-3.5 rounded border-border"
                      />
                      <div>
                        <p className="text-sm font-medium">{comment.author}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        comment.isApproved
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                      }`}
                    >
                      {comment.isApproved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">{comment.content}</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        comment.parentType === 'products'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {comment.parentType === 'products' ? 'Product' : 'Post'}
                    </span>
                    <span className="text-xs text-muted-foreground">{truncate(comment.parentTitle, 25)}</span>
                    {comment.rating != null && (
                      <span className="text-xs text-amber-500">
                        {'★'.repeat(comment.rating)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!comment.isApproved ? (
                      <button
                        onClick={() => handleApprove(comment.id)}
                        disabled={isPending}
                        className="flex-1 rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReject(comment.id)}
                        disabled={isPending}
                        className="flex-1 rounded-md bg-yellow-600 px-2 py-1 text-xs font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(comment.id)}
                      disabled={isPending}
                      className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, totalDocs)} of {totalDocs}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isPending}
              className="rounded-md border border-border px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isPending}
              className="rounded-md border border-border px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
