'use client'

import React, { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { getTenantsList, updateTenantStatus, type TenantSummary } from './actions'

export default function AdminPanel() {
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    loadTenants()
  }, [])

  async function loadTenants() {
    setLoading(true)
    const result = await getTenantsList()
    if (result.error) {
      setError(result.error)
    } else {
      setTenants(result.tenants)
    }
    setLoading(false)
  }

  function handleToggleStatus(tenant: TenantSummary) {
    const newStatus = tenant.status === 'active' ? 'inactive' : 'active'
    startTransition(async () => {
      const result = await updateTenantStatus(tenant.id, newStatus as 'active' | 'inactive')
      if (result.success) {
        setTenants((prev) =>
          prev.map((t) => (t.id === tenant.id ? { ...t, status: newStatus } : t)),
        )
      }
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (error) {
    const isAuthError = error === 'Not authenticated'
    return (
      <div className={`rounded-lg border p-6 ${isAuthError ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400' : 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'}`}>
        <p className="font-medium">{isAuthError ? 'Session Loading' : 'Access Denied'}</p>
        <p className="mt-1 text-sm">
          {isAuthError
            ? 'Your session is still loading. This usually resolves in a moment.'
            : error}
        </p>
        <button
          onClick={() => {
            setError(null)
            loadTenants()
          }}
          className="mt-3 rounded-md border border-current px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenant Administration</h1>
          <p className="text-sm text-muted-foreground">
            {tenants.length} tenant{tenants.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="admin/error-logs"
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            Error Logs
          </Link>
          <Link
            href="admin/suitcase"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Suitcase Manager
          </Link>
          <Link
            href="admin/provision"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + New Tenant
          </Link>
        </div>
      </div>

      {/* Tenant Cards */}
      {tenants.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">No tenants yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Provision your first tenant to get started
          </p>
          <Link
            href="admin/provision"
            className="mt-4 inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Provision Tenant
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <TenantCard
              key={String(tenant.id)}
              tenant={tenant}
              onToggleStatus={handleToggleStatus}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TenantCard({
  tenant,
  onToggleStatus,
  isPending,
}: {
  tenant: TenantSummary
  onToggleStatus: (t: TenantSummary) => void
  isPending: boolean
}) {
  const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
    inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    provisioning: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  }

  const accentColor = tenant.branding?.primaryColor || '#10B981'

  return (
    <div className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md">
      {/* Color accent bar */}
      <div className="mb-3 h-1 w-12 rounded-full" style={{ backgroundColor: accentColor }} />

      {/* Name + badge */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">{tenant.name}</h3>
          <p className="truncate text-sm text-muted-foreground">{tenant.domain}</p>
        </div>
        <span
          className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[tenant.status] || statusColors.inactive}`}
        >
          {tenant.status}
        </span>
      </div>

      {/* Tagline */}
      {tenant.branding?.tagline && (
        <p className="mt-2 truncate text-sm italic text-muted-foreground">
          {tenant.branding.tagline}
        </p>
      )}

      {/* Stats */}
      <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
        <span>{tenant.spacesCount} spaces</span>
        <span>{tenant.usersCount} members</span>
        <span className="text-xs">
          {tenant.type === 'platform' ? 'Platform' : 'Tenant'}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="font-mono text-xs text-muted-foreground">{tenant.slug}</span>
        <button
          onClick={() => onToggleStatus(tenant)}
          disabled={isPending || tenant.type === 'platform'}
          className="rounded-md px-3 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          {tenant.status === 'active' ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  )
}
