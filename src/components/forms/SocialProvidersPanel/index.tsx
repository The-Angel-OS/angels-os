'use client'

import React, { useState } from 'react'
import { useAuth } from '@/providers/Auth'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getClientSideURL } from '@/utilities/getURL'

/**
 * Provider metadata — display info and OAuth initiation paths.
 * Add new providers here as they become available.
 */
const PROVIDER_META: Record<
  string,
  {
    label: string
    color: string
    icon: React.ReactNode
    linkUrl: string
  }
> = {
  google: {
    label: 'Google',
    color: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    ),
    linkUrl: '/api/auth/google?mode=link&redirect=/account',
  },
  github: {
    label: 'GitHub',
    color: 'bg-gray-900 text-white hover:bg-gray-800',
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
    linkUrl: '/api/auth/github?mode=link&redirect=/account',
  },
  apple: {
    label: 'Apple',
    color: 'bg-black text-white hover:bg-gray-900',
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    ),
    linkUrl: '/api/auth/apple?mode=link&redirect=/account',
  },
  discord: {
    label: 'Discord',
    color: 'bg-[#5865F2] text-white hover:bg-[#4752c4]',
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
      </svg>
    ),
    linkUrl: '/api/auth/discord?mode=link&redirect=/account',
  },
}

// Providers that have actual OAuth endpoints implemented
const AVAILABLE_PROVIDERS = ['google', 'discord']

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
