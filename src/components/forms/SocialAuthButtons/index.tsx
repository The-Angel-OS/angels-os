'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { PROVIDER_META, AVAILABLE_PROVIDERS } from './providers'

interface SocialAuthButtonsProps {
  /** Post-auth redirect path (e.g., '/dashboard') */
  redirect?: string | null
}

/**
 * Shared social auth buttons for login and signup forms.
 *
 * Renders a vertical stack of OAuth provider buttons based on AVAILABLE_PROVIDERS.
 * Each button navigates to the provider's OAuth initiation endpoint.
 *
 * Used by LoginForm and CreateAccountForm.
 */
export function SocialAuthButtons({ redirect }: SocialAuthButtonsProps) {
  return (
    <div className="flex flex-col gap-3">
      {AVAILABLE_PROVIDERS.map((provider) => {
        const meta = PROVIDER_META[provider]
        if (!meta) return null

        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => {
              const redirectParam = redirect
                ? `?redirect=${encodeURIComponent(redirect)}`
                : ''
              window.location.href = `/api/auth/${provider}${redirectParam}`
            }}
          >
            <span className="mr-2">{meta.icon}</span>
            Continue with {meta.label}
          </Button>
        )
      })}
    </div>
  )
}
