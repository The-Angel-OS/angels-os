'use client'

import React, { useState } from 'react'
import { useAuth } from '@/providers/Auth'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getClientSideURL } from '@/utilities/getURL'
import { PROVIDER_META, AVAILABLE_PROVIDERS } from '@/components/forms/SocialAuthButtons/providers'

interface LinkedProvider {
  id: string
  provider: string
  providerId: string
  email?: string | null
  displayName?: string | null
  avatarUrl?: string | null
  linkedAt?: string | null
}

/**
 * SocialProvidersPanel — Manage linked social login accounts.
 *
 * Shows currently linked providers with unlink capability,
 * and available providers that can be linked.
 */
export function SocialProvidersPanel() {
  const { user, setUser } = useAuth()
  const [unlinking, setUnlinking] = useState<string | null>(null)

  if (!user) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkedProviders: LinkedProvider[] = Array.isArray((user as any).socialProviders)
    ? (user as any).socialProviders
    : []

  const handleUnlink = async (provider: string, providerId: string) => {
    setUnlinking(providerId)
    try {
      const res = await fetch(`${getClientSideURL()}/api/auth/social-unlink`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, providerId }),
      })

      if (res.ok) {
        toast.success(`${PROVIDER_META[provider]?.label || provider} account unlinked.`)
        // Refresh user data
        const meRes = await fetch(`${getClientSideURL()}/api/users/me`, {
          credentials: 'include',
        })
        if (meRes.ok) {
          const meData = await meRes.json()
          setUser(meData.user || null)
        }
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to unlink provider.')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setUnlinking(null)
    }
  }

  const handleLink = (provider: string) => {
    const meta = PROVIDER_META[provider]
    if (!meta) return
    // Navigate to OAuth flow — will redirect back to /account after linking
    window.location.href = meta.linkUrl
  }

  // Determine which providers can still be linked
  const linkedProviderNames = new Set(linkedProviders.map((p) => p.provider))
  const unlinkableProviders = AVAILABLE_PROVIDERS.filter((p) => !linkedProviderNames.has(p))

  return (
    <div className="space-y-6">
      <div className="prose dark:prose-invert">
        <p className="text-sm text-muted-foreground">
          Link your social accounts for faster sign-in. You can sign in with any linked provider.
        </p>
      </div>

      {/* Linked providers */}
      {linkedProviders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Linked Accounts
          </h3>
          {linkedProviders.map((linked) => {
            const meta = PROVIDER_META[linked.provider]
            if (!meta) return null
            return (
              <div
                key={linked.id || linked.providerId}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    {linked.avatarUrl ? (
                      <img
                        src={linked.avatarUrl}
                        alt={linked.displayName || meta.label}
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      meta.icon
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{meta.label}</span>
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        Connected
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {linked.displayName || linked.email || linked.providerId}
                    </p>
                    {linked.email && linked.email !== linked.displayName && (
                      <p className="text-xs text-muted-foreground/60">{linked.email}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnlink(linked.provider, linked.providerId)}
                  disabled={unlinking === linked.providerId}
                  className="text-destructive hover:text-destructive"
                >
                  {unlinking === linked.providerId ? 'Unlinking...' : 'Unlink'}
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Link more providers */}
      {unlinkableProviders.length > 0 && (
        <div className="space-y-3">
          {linkedProviders.length > 0 ? (
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Link Another Account
            </h3>
          ) : (
            <p className="text-sm text-muted-foreground">
              No social accounts linked yet. Link one for faster sign-in.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {unlinkableProviders.map((provider) => {
              const meta = PROVIDER_META[provider]
              if (!meta) return null
              return (
                <button
                  key={provider}
                  onClick={() => handleLink(provider)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${meta.color}`}
                >
                  {meta.icon}
                  Link {meta.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* All linked, nothing available */}
      {linkedProviders.length > 0 && unlinkableProviders.length === 0 && (
        <p className="text-sm text-muted-foreground">
          All available social providers are linked. More providers coming soon.
        </p>
      )}
    </div>
  )
}
