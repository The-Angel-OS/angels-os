import type { CollectionAfterChangeHook } from 'payload'
import type { User } from '@/payload-types'

/**
 * Escalate a "new user registered" event to the tenant's Gotify connector(s).
 *
 * The operator's pulse on a quiet node: there may be no human in the dashboard,
 * so a real registration ("who just signed up") should reach the phone. Routed
 * through the same escalation dispatcher as errors — per-connector policy +
 * rate-limit + cooldown apply, and it's a no-op if no gotify connector enables
 * the `user_registered` event.
 *
 * Fires only on genuine new registrations: create-only, skips system users and
 * synthetic guest accounts (bridge/connector-created). Fully fail-soft — never
 * blocks or fails user creation.
 */
export const notifyUserRegistered: CollectionAfterChangeHook<User> = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc
  if ((doc as { isSystemUser?: boolean }).isSystemUser) return doc
  // Bridge/connector guests use a synthetic domain — not real registrations.
  if (typeof doc.email === 'string' && doc.email.endsWith('@guests.angel-os.local')) return doc

  const tenantRaw = (doc as { tenant?: unknown }).tenant
  const tenantId =
    tenantRaw && typeof tenantRaw === 'object'
      ? (tenantRaw as { id: number | string }).id
      : (tenantRaw as number | string | undefined)
  if (tenantId == null) return doc

  try {
    const { dispatchEscalation } = await import('@/utilities/escalation')
    const who = doc.name || doc.email || 'Someone'
    const roles = Array.isArray(doc.roles) && doc.roles.length ? ` (${doc.roles.join(', ')})` : ''
    await dispatchEscalation(req.payload as never, {
      tenantId,
      eventType: 'user_registered',
      title: '🙋 New user registered',
      message: `${who}${roles} just registered.`,
      dedupeKey: String(doc.id),
      priority: 7,
    }).catch(() => {})
  } catch {
    // Non-critical — escalation must never block registration.
  }
  return doc
}
