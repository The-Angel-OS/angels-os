'use client'

import React, { useEffect, useState, useTransition, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Globe,
  Users,
  MessageSquare,
  Package,
  ShoppingCart,
  Palette,
  Shield,
  Hash,
  AlertTriangle,
  Check,
  X,
  Pencil,
  ExternalLink,
} from 'lucide-react'
import { getTenantDetail, updateTenantBranding, deactivateTenant } from './actions'
import type { TenantDetail } from './actions'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  provisioning: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
}

const VISIBILITY_STYLES: Record<string, string> = {
  public: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  invite_only: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  private: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
}

export function TenantDetailView({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string; locale: string }>
}) {
  const params = use(paramsPromise)
  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingBranding, setEditingBranding] = useState(false)
  const [brandingForm, setBrandingForm] = useState({
    siteName: '',
    tagline: '',
    primaryColor: '',
  })
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    loadTenant()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  async function loadTenant() {
    setLoading(true)
    const result = await getTenantDetail(params.id)
    if (result.error) {
      setError(result.error)
    } else if (result.tenant) {
      setTenant(result.tenant)
      setBrandingForm({
        siteName: result.tenant.branding?.siteName || '',
        tagline: result.tenant.branding?.tagline || '',
        primaryColor: result.tenant.branding?.primaryColor || '#10B981',
      })
    }
    setLoading(false)
  }

  function handleSaveBranding() {
    if (!tenant) return
    startTransition(async () => {
      const result = await updateTenantBranding(tenant.id, brandingForm)
      if (result.success) {
        setTenant((prev) =>
          prev ? { ...prev, branding: { ...prev.branding, ...brandingForm } } : prev,
        )
        setEditingBranding(false)
      }
    })
  }

  function handleDeactivate() {
    if (!tenant) return
    startTransition(async () => {
      const result = await deactivateTenant(tenant.id)
      if (result.success) {
        setTenant((prev) => (prev ? { ...prev, status: 'inactive' } : prev))
        setShowDeactivateConfirm(false)
      }
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !tenant) {
    return (
      <div className="space-y-4">
        <Link
          href="../"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to Tenants
        </Link>
        <div className="rounded-lg border border-red-300 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          <p className="font-medium">Error</p>
          <p className="mt-1 text-sm">{error || 'Tenant not found'}</p>
        </div>
      </div>
    )
  }

  const accentColor = tenant.branding?.primaryColor || '#10B981'

  return (
    <div className="space-y-6">
      {/* ─── Back Link ─── */}
      <Link
        href="../"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Back to Tenants
      </Link>

      {/* ─── Header ─── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="h-2" style={{ backgroundColor: accentColor }} />
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                {tenant.branding?.logoUrl && (
                  <img
                    src={tenant.branding.logoUrl}
                    alt={tenant.name}
                    className="h-10 w-10 rounded-lg object-contain"
                  />
                )}
                <div>
                  <h1 className="text-2xl font-bold">{tenant.branding?.siteName || tenant.name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {tenant.domain || tenant.slug}
                    {tenant.branding?.tagline && ` \u2014 ${tenant.branding.tagline}`}
                  </p>
                </div>
              </div>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[tenant.status] || STATUS_STYLES.inactive}`}
            >
              {tenant.status}
            </span>
          </div>

          {/* Quick stats row */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Globe size={14} /> {tenant.domain || 'No domain'}
            </span>
            <span className="font-mono text-xs">{tenant.slug}</span>
            <span>{tenant.type === 'platform' ? 'Platform' : 'Tenant'}</span>
            {tenant.businessType && <span>{tenant.businessType}</span>}
          </div>
        </div>
      </div>

      {/* ─── Stats Grid ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { icon: Users, label: 'Members', value: tenant.membersCount },
          { icon: MessageSquare, label: 'Messages', value: tenant.messagesCount },
          { icon: Hash, label: 'Spaces', value: tenant.spacesCount },
          { icon: Package, label: 'Products', value: tenant.productsCount },
          { icon: ShoppingCart, label: 'Orders', value: tenant.ordersCount },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon size={14} />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ─── Branding Panel ─── */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Palette size={14} /> Branding
            </h2>
            {!editingBranding && (
              <button
                onClick={() => setEditingBranding(true)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                <Pencil size={12} /> Edit
              </button>
            )}
          </div>

          {editingBranding ? (
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Site Name</label>
                <input
                  type="text"
                  value={brandingForm.siteName}
                  onChange={(e) =>
                    setBrandingForm((f) => ({ ...f, siteName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tagline</label>
                <input
                  type="text"
                  value={brandingForm.tagline}
                  onChange={(e) =>
                    setBrandingForm((f) => ({ ...f, tagline: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Primary Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={brandingForm.primaryColor}
                    onChange={(e) =>
                      setBrandingForm((f) => ({ ...f, primaryColor: e.target.value }))
                    }
                    className="h-8 w-8 cursor-pointer rounded border border-border"
                  />
                  <input
                    type="text"
                    value={brandingForm.primaryColor}
                    onChange={(e) =>
                      setBrandingForm((f) => ({ ...f, primaryColor: e.target.value }))
                    }
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveBranding}
                  disabled={isPending}
                  className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Check size={12} /> {isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingBranding(false)}
                  className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  <X size={12} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Site Name</span>
                <span>{tenant.branding?.siteName || '\u2014'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tagline</span>
                <span className="truncate max-w-[200px]">{tenant.branding?.tagline || '\u2014'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Primary Color</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-4 w-4 rounded-full border border-border"
                    style={{ backgroundColor: accentColor }}
                  />
                  <span className="font-mono text-xs">{accentColor}</span>
                </div>
              </div>
              {tenant.branding?.headingFont && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Heading Font</span>
                  <span>{tenant.branding.headingFont}</span>
                </div>
              )}
              {tenant.branding?.bodyFont && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Body Font</span>
                  <span>{tenant.branding.bodyFont}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Config Panel ─── */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Shield size={14} /> Configuration
          </h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Domain</span>
              <span>{tenant.domain || '\u2014'}</span>
            </div>
            {tenant.additionalDomains && tenant.additionalDomains.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aliases</span>
                <span className="text-right text-xs">
                  {tenant.additionalDomains.join(', ')}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slug</span>
              <span className="font-mono text-xs">{tenant.slug}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="capitalize">{tenant.type}</span>
            </div>
            {tenant.businessType && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Business Type</span>
                <span className="capitalize">{tenant.businessType.replace(/_/g, ' ')}</span>
              </div>
            )}
            {tenant.commerce?.currency && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currency</span>
                <span className="uppercase">{tenant.commerce.currency}</span>
              </div>
            )}
            {tenant.stripeConnect?.accountId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stripe Connect</span>
                <span className="flex items-center gap-1 text-xs">
                  {tenant.stripeConnect.chargesEnabled ? (
                    <Check size={12} className="text-emerald-500" />
                  ) : (
                    <X size={12} className="text-amber-500" />
                  )}
                  {tenant.stripeConnect.onboardingComplete ? 'Active' : 'Pending'}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="text-xs">
                {new Date(tenant.createdAt).toLocaleDateString()}
              </span>
            </div>
            {tenant.lastActivity && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Activity</span>
                <span className="text-xs">
                  {new Date(tenant.lastActivity).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Members Panel ─── */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Users size={14} /> Members ({tenant.membersCount})
        </h2>
        {tenant.members.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No members yet</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Roles</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenant.members.map((member) => (
                  <tr key={String(member.id)} className="border-b border-border/50">
                    <td className="py-2 pr-4">{member.userName}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{member.userEmail}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {member.roles.map((role) => (
                          <span
                            key={role}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          member.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Spaces & Channels Panel ─── */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Hash size={14} /> Spaces & Channels ({tenant.spacesCount})
        </h2>
        {tenant.spaces.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No spaces yet</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tenant.spaces.map((space) => (
              <div
                key={String(space.id)}
                className="rounded-lg border border-border bg-background p-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">{space.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      VISIBILITY_STYLES[space.visibility] || VISIBILITY_STYLES.public
                    }`}
                  >
                    {space.visibility.replace('_', ' ')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {space.channelCount} channel{space.channelCount !== 1 ? 's' : ''}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                  {space.slug}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Danger Zone ─── */}
      {tenant.type !== 'platform' && (
        <div className="rounded-lg border border-red-300 bg-red-50/50 p-5 dark:border-red-900 dark:bg-red-950/30">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
            <AlertTriangle size={14} /> Danger Zone
          </h2>
          {tenant.status === 'active' ? (
            <>
              <p className="mt-2 text-sm text-red-600/80 dark:text-red-400/80">
                Deactivating this tenant will prevent all members from accessing the dashboard.
              </p>
              {showDeactivateConfirm ? (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handleDeactivate}
                    disabled={isPending}
                    className="rounded-md bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {isPending ? 'Deactivating...' : 'Confirm Deactivation'}
                  </button>
                  <button
                    onClick={() => setShowDeactivateConfirm(false)}
                    className="rounded-md border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeactivateConfirm(true)}
                  className="mt-3 rounded-md border border-red-300 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Deactivate Tenant
                </button>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              This tenant is currently <span className="font-medium">{tenant.status}</span>.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
