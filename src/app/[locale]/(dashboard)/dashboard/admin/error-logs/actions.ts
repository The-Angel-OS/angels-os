'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'

export interface LogEntry {
  id: string | number
  level: 'error' | 'warning' | 'info' | 'debug'
  source: string
  message: string
  details?: string
  statusCode?: number
  url?: string
  userId?: string
  tenantId?: string
  resolved: boolean
  createdAt: string
}

/** Authenticate and check admin role — returns user or error. */
async function requireAdmin() {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    return { payload, user: null, error: 'Not authenticated' as const }
  }

  const roles = (user as any).roles as string[] | undefined
  const isAdmin =
    roles?.includes('super_admin') ||
    roles?.includes('admin') ||
    roles?.includes('archangel')

  if (!isAdmin) {
    return { payload, user, error: 'Insufficient permissions' as const }
  }

  return { payload, user, error: null }
}

/** Fetch paginated, filtered error logs. */
export async function getErrorLogs(opts?: {
  page?: number
  limit?: number
  level?: string
  source?: string
  resolved?: boolean
  search?: string
}): Promise<{
  logs: LogEntry[]
  totalDocs: number
  totalPages: number
  page: number
  error?: string
}> {
  const empty = { logs: [], totalDocs: 0, totalPages: 0, page: 1 }
  try {
    const { payload, error } = await requireAdmin()
    if (error) return { ...empty, error }

    const where: Record<string, any> = {}

    if (opts?.level && opts.level !== 'all') {
      where.level = { equals: opts.level }
    }
    if (opts?.source) {
      where.source = { contains: opts.source }
    }
    if (opts?.resolved !== undefined) {
      where.resolved = { equals: opts.resolved }
    }
    if (opts?.search) {
      where.or = [
        { message: { contains: opts.search } },
        { source: { contains: opts.search } },
        { details: { contains: opts.search } },
      ]
    }

    const result = await payload.find({
      collection: 'application-logs',
      where: Object.keys(where).length > 0 ? where : undefined,
      page: opts?.page ?? 1,
      limit: opts?.limit ?? 25,
      sort: '-createdAt',
      overrideAccess: true,
    })

    const logs: LogEntry[] = result.docs.map((doc: any) => ({
      id: doc.id,
      level: doc.level,
      source: doc.source,
      message: doc.message,
      details: doc.details ?? undefined,
      statusCode: doc.statusCode ?? undefined,
      url: doc.url ?? undefined,
      userId: doc.userId ?? undefined,
      tenantId: doc.tenantId ?? undefined,
      resolved: doc.resolved ?? false,
      createdAt: doc.createdAt,
    }))

    return {
      logs,
      totalDocs: result.totalDocs,
      totalPages: result.totalPages,
      page: result.page ?? 1,
    }
  } catch (err) {
    console.error('getErrorLogs error:', err)
    return { ...empty, error: err instanceof Error ? err.message : 'Failed to load logs' }
  }
}

/** Toggle the resolved status of a log entry. */
export async function toggleLogResolved(
  logId: string | number,
  resolved: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { payload, error } = await requireAdmin()
    if (error) return { success: false, error }

    await payload.update({
      collection: 'application-logs',
      id: logId,
      data: { resolved } as any,
      overrideAccess: true,
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Update failed' }
  }
}

/** Delete old resolved logs (bulk cleanup). */
export async function clearResolvedLogs(): Promise<{ deleted: number; error?: string }> {
  try {
    const { payload, error } = await requireAdmin()
    if (error) return { deleted: 0, error }

    const result = await payload.delete({
      collection: 'application-logs',
      where: { resolved: { equals: true } },
      overrideAccess: true,
    })

    const deleted = Array.isArray(result.docs) ? result.docs.length : 0
    return { deleted }
  } catch (err) {
    return { deleted: 0, error: err instanceof Error ? err.message : 'Cleanup failed' }
  }
}

/** Get aggregate counts by level for the summary bar. */
export async function getLogCounts(): Promise<{
  total: number
  errors: number
  warnings: number
  unresolved: number
  error?: string
}> {
  const empty = { total: 0, errors: 0, warnings: 0, unresolved: 0 }
  try {
    const { payload, error } = await requireAdmin()
    if (error) return { ...empty, error }

    const [total, errors, warnings, unresolved] = await Promise.all([
      payload.count({ collection: 'application-logs', overrideAccess: true }),
      payload.count({
        collection: 'application-logs',
        where: { level: { equals: 'error' } },
        overrideAccess: true,
      }),
      payload.count({
        collection: 'application-logs',
        where: { level: { equals: 'warning' } },
        overrideAccess: true,
      }),
      payload.count({
        collection: 'application-logs',
        where: { resolved: { equals: false } },
        overrideAccess: true,
      }),
    ])

    return {
      total: total.totalDocs,
      errors: errors.totalDocs,
      warnings: warnings.totalDocs,
      unresolved: unresolved.totalDocs,
    }
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : 'Failed to load counts' }
  }
}
