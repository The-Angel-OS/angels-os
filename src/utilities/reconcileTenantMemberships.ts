/**
 * reconcileTenantMemberships — enforce the invariant "one person, one membership".
 *
 * A pending email invite is a userless tenant-membership keyed by
 * invitationDetails.invitationEmail; once that person actually joins they get a
 * second, user-linked membership — and the invite is left orphaned (often with a
 * different, higher role: the "Tyler is both a pending Admin invite AND an active
 * Member" bug). This collapses every membership sharing a normalized email into a
 * single canonical row holding the UNION of their grants, then deletes the rest.
 *
 * The merge decision is a PURE function (chooseMembershipMerge) so it's exhaustively
 * testable; the IO layer just groups by email and applies it.
 */

const ROLE_RANK: Record<string, number> = { tenant_admin: 3, tenant_manager: 2, tenant_member: 1 }
const STATUS_RANK: Record<string, number> = { active: 3, pending: 2, suspended: 1, revoked: 0 }

export interface MembershipLike {
  id: string | number
  status: string
  role: string
  /** True when a real user account is linked (vs a userless email invite). */
  hasUser: boolean
  permissions?: string[]
}

export interface MergeDecision {
  keepId: string | number
  role: string
  status: string
  permissions: string[]
  deleteIds: Array<string | number>
  /** True when the kept row's role is raised by honoring a higher-role duplicate. */
  rolePromoted: boolean
}

/**
 * Decide how to collapse a group of memberships for ONE person. Canonical = the
 * row with a real user, then most-progressed status, then highest role. The kept
 * row takes the UNION: highest role across the group (honoring an explicit
 * higher-role invite), active if any was active, and merged permissions.
 * Returns null for a group that needs no merge (0 or 1 members).
 */
export function chooseMembershipMerge(group: MembershipLike[]): MergeDecision | null {
  if (group.length <= 1) return null

  const sorted = [...group].sort((a, b) => {
    if (a.hasUser !== b.hasUser) return a.hasUser ? -1 : 1
    const s = (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0)
    if (s) return s
    return (ROLE_RANK[b.role] ?? 0) - (ROLE_RANK[a.role] ?? 0)
  })
  const keep = sorted[0]

  const bestRole = group.reduce(
    (best, m) => ((ROLE_RANK[m.role] ?? 0) > (ROLE_RANK[best] ?? 0) ? m.role : best),
    keep.role,
  )
  const status = group.some((m) => m.status === 'active') ? 'active' : keep.status
  const permissions = Array.from(new Set(group.flatMap((m) => m.permissions || [])))

  return {
    keepId: keep.id,
    role: bestRole,
    status,
    permissions,
    deleteIds: group.filter((m) => m.id !== keep.id).map((m) => m.id),
    rolePromoted: (ROLE_RANK[bestRole] ?? 0) > (ROLE_RANK[keep.role] ?? 0),
  }
}

/** Normalize an email for grouping (lowercased, trimmed). */
export function membershipEmailKey(
  doc: { user?: unknown; invitationDetails?: { invitationEmail?: string } | null },
): string | null {
  const user = doc.user && typeof doc.user === 'object' ? (doc.user as { email?: string }) : null
  const email = user?.email || doc.invitationDetails?.invitationEmail
  return email ? String(email).trim().toLowerCase() : null
}

export interface ReconcileResult {
  groupsMerged: number
  membershipsDeleted: number
  rolePromotions: number
}

/**
 * Collapse all duplicate memberships in a tenant. Idempotent: a clean tenant is a
 * no-op. Writes are SEQUENTIAL (never parallelize on the max=3 Vercel pool).
 */
export async function reconcileDuplicateMemberships(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  tenantId: string | number,
): Promise<ReconcileResult> {
  const res = await payload.find({
    collection: 'tenant-memberships',
    where: { tenant: { equals: tenantId } },
    limit: 1000,
    depth: 1, // resolve user.email
    overrideAccess: true,
  })

  // Group by normalized email.
  const groups = new Map<string, MembershipLike[]>()
  const rawById = new Map<string, Record<string, unknown>>()
  for (const doc of (res.docs || []) as Array<Record<string, unknown>>) {
    const key = membershipEmailKey(doc as { user?: unknown; invitationDetails?: { invitationEmail?: string } | null })
    if (!key) continue
    rawById.set(String(doc.id), doc)
    const like: MembershipLike = {
      id: doc.id as string | number,
      status: String(doc.status || ''),
      role: String(doc.role || 'tenant_member'),
      hasUser: doc.user != null,
      permissions: Array.isArray(doc.permissions) ? (doc.permissions as string[]) : [],
    }
    const arr = groups.get(key) || []
    arr.push(like)
    groups.set(key, arr)
  }

  const result: ReconcileResult = { groupsMerged: 0, membershipsDeleted: 0, rolePromotions: 0 }

  for (const group of groups.values()) {
    const decision = chooseMembershipMerge(group)
    if (!decision) continue

    // Ensure the kept row carries the real user, if any duplicate had one.
    const keptRaw = rawById.get(String(decision.keepId))
    const userId =
      keptRaw?.user != null
        ? keptRaw.user
        : group
            .map((m) => rawById.get(String(m.id))?.user)
            .find((u) => u != null) ?? undefined

    try {
      await payload.update({
        collection: 'tenant-memberships',
        id: decision.keepId,
        data: {
          role: decision.role,
          status: decision.status,
          permissions: decision.permissions,
          ...(userId != null ? { user: typeof userId === 'object' ? (userId as { id: unknown }).id : userId } : {}),
        },
        overrideAccess: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        overrideLock: true as any,
      })
      result.groupsMerged += 1
      if (decision.rolePromoted) result.rolePromotions += 1

      for (const id of decision.deleteIds) {
        try {
          await payload.delete({ collection: 'tenant-memberships', id, overrideAccess: true })
          result.membershipsDeleted += 1
        } catch {
          /* keep going — a failed delete just leaves one extra row */
        }
      }
    } catch {
      /* skip this group on failure; reconcile is idempotent and can re-run */
    }
  }

  return result
}
