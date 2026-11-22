import React from 'react'
import { JoinToUnlockPanel } from '@/components/memberships/JoinToUnlockModal'

/**
 * MembersOnlyGate — rendered in place of a gated page or post's content when
 * the viewer isn't eligible. Renders the Patreon-style inline JoinToUnlockPanel
 * with blurred preview, creator tier selector, Square/PayPal checkout, and inline
 * sign-in returning directly to `path` on completion.
 *
 * @see src/utilities/pageAccess.ts  @see docs/planning/MEMBERSHIP_GATING.md
 */
export function MembersOnlyGate({
  access,
  path,
  title,
  thumbnailUrl,
  description,
}: {
  access: string
  isAuthenticated?: boolean
  path: string
  title?: string
  thumbnailUrl?: string | null
  description?: string | null
}) {
  return (
    <section className="container py-12 md:py-16">
      <JoinToUnlockPanel
        access={access}
        targetPath={path}
        title={title}
        thumbnailUrl={thumbnailUrl}
        description={description}
      />
    </section>
  )
}
