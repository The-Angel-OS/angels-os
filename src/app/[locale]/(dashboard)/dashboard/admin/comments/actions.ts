'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CommentRecord {
  id: string | number
  author: string
  email: string
  content: string
  rating: number | null
  isApproved: boolean
  parentType: 'posts' | 'products'
  parentTitle: string
  parentId: string | number
  createdAt: string
}

export interface CommentsResult {
  success: boolean
  comments: CommentRecord[]
  totalDocs: number
  totalPages: number
  page: number
  error?: string
}

export interface CommentStats {
  total: number
  pending: number
  approved: number
  postComments: number
  productReviews: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthenticatedAdmin() {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    return { payload, user: null, tenantId: null, error: 'Not authenticated' }
  }

  const roles = (user as any).roles as string[] | undefined
  const isAdmin = Boolean(
    roles?.includes('super_admin') || roles?.includes('admin') || roles?.includes('archangel'),
  )

  if (!isAdmin) {
    return { payload, user, tenantId: null, error: 'Insufficient permissions' }
  }

  // Resolve tenant from header
  const tenantSlug =
    headersList.get('x-tenant-id') || process.env.DEFAULT_TENANT_SLUG || 'default'
  const tenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: tenantSlug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const tenantId = tenants.docs[0]?.id
  if (!tenantId) {
    return { payload, user, tenantId: null, error: 'Tenant not found' }
  }

  return { payload, user, tenantId, error: null }
}

function serializeComment(doc: any): CommentRecord {
  const parent = doc.parent || {}
  const parentRelation = parent.relationTo || 'posts'
  const parentValue = parent.value

  let parentTitle = 'Unknown'
  if (typeof parentValue === 'object' && parentValue !== null) {
    parentTitle = parentValue.title || parentValue.name || `#${parentValue.id}`
  } else if (parentValue) {
    parentTitle = `#${parentValue}`
  }

  return {
    id: doc.id,
    author: doc.author || 'Anonymous',
    email: doc.email || '',
    content: doc.content || '',
    rating: doc.rating ?? null,
    isApproved: Boolean(doc.isApproved),
    parentType: parentRelation,
    parentTitle,
    parentId: typeof parentValue === 'object' ? parentValue?.id : parentValue,
    createdAt: doc.createdAt || new Date().toISOString(),
  }
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getCommentStats(): Promise<CommentStats & { error?: string }> {
  const { payload, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId) {
    return { total: 0, pending: 0, approved: 0, postComments: 0, productReviews: 0, error: error || 'No tenant' }
  }

  const tenantFilter = { tenant: { equals: tenantId } }

  const [total, approved, postComments, productReviews] = await Promise.all([
    payload.count({
      collection: 'comments',
      where: tenantFilter,
      overrideAccess: true,
    }),
    payload.count({
      collection: 'comments',
      where: { and: [tenantFilter, { isApproved: { equals: true } }] },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'comments',
      where: { and: [tenantFilter, { 'parent.relationTo': { equals: 'posts' } }] } as any,
      overrideAccess: true,
    }),
    payload.count({
      collection: 'comments',
      where: { and: [tenantFilter, { 'parent.relationTo': { equals: 'products' } }] } as any,
      overrideAccess: true,
    }),
  ])

  return {
    total: total.totalDocs,
    pending: total.totalDocs - approved.totalDocs,
    approved: approved.totalDocs,
    postComments: postComments.totalDocs,
    productReviews: productReviews.totalDocs,
  }
}

export async function getComments(filters?: {
  search?: string
  status?: 'all' | 'pending' | 'approved'
  parentType?: 'all' | 'posts' | 'products'
  page?: number
  limit?: number
}): Promise<CommentsResult> {
  const { payload, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId) {
    return { success: false, comments: [], totalDocs: 0, totalPages: 0, page: 1, error: error || 'No tenant' }
  }

  const conditions: any[] = [{ tenant: { equals: tenantId } }]

  if (filters?.status === 'pending') {
    conditions.push({ isApproved: { equals: false } })
  } else if (filters?.status === 'approved') {
    conditions.push({ isApproved: { equals: true } })
  }

  if (filters?.parentType && filters.parentType !== 'all') {
    conditions.push({ 'parent.relationTo': { equals: filters.parentType } })
  }

  if (filters?.search) {
    conditions.push({
      or: [
        { author: { like: filters.search } },
        { email: { like: filters.search } },
        { content: { like: filters.search } },
      ],
    })
  }

  const page = filters?.page || 1
  const limit = filters?.limit || 25

  const result = await payload.find({
    collection: 'comments',
    where: { and: conditions } as any,
    sort: '-createdAt',
    page,
    limit,
    depth: 1, // Resolve parent post/product titles
    overrideAccess: true,
  })

  return {
    success: true,
    comments: result.docs.map(serializeComment),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    page: result.page || 1,
  }
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function approveComment(
  commentId: string | number,
): Promise<{ success: boolean; error?: string }> {
  const { payload, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId) return { success: false, error: error || 'No tenant' }

  try {
    await payload.update({
      collection: 'comments',
      id: commentId,
      data: { isApproved: true },
      overrideAccess: true,
    })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to approve comment' }
  }
}

export async function rejectComment(
  commentId: string | number,
): Promise<{ success: boolean; error?: string }> {
  const { payload, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId) return { success: false, error: error || 'No tenant' }

  try {
    await payload.update({
      collection: 'comments',
      id: commentId,
      data: { isApproved: false },
      overrideAccess: true,
    })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to reject comment' }
  }
}

export async function deleteComment(
  commentId: string | number,
): Promise<{ success: boolean; error?: string }> {
  const { payload, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId) return { success: false, error: error || 'No tenant' }

  try {
    await payload.delete({
      collection: 'comments',
      id: commentId,
      overrideAccess: true,
    })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to delete comment' }
  }
}

export async function bulkApprove(
  commentIds: (string | number)[],
): Promise<{ success: boolean; approved: number; error?: string }> {
  const { payload, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId) return { success: false, approved: 0, error: error || 'No tenant' }

  let approved = 0
  for (const id of commentIds) {
    try {
      await payload.update({
        collection: 'comments',
        id,
        data: { isApproved: true },
        overrideAccess: true,
      })
      approved++
    } catch {
      // Skip individual failures
    }
  }

  return { success: true, approved }
}

export async function bulkDelete(
  commentIds: (string | number)[],
): Promise<{ success: boolean; deleted: number; error?: string }> {
  const { payload, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId) return { success: false, deleted: 0, error: error || 'No tenant' }

  let deleted = 0
  for (const id of commentIds) {
    try {
      await payload.delete({
        collection: 'comments',
        id,
        overrideAccess: true,
      })
      deleted++
    } catch {
      // Skip individual failures
    }
  }

  return { success: true, deleted }
}
