/**
 * Google People API contact import.
 *
 * Pulls the signed-in user's Google contacts into their CRM `contacts` (idempotent
 * by email per tenant — the same upsert save_contact does), so LEO can invite them
 * into a Circle/endeavor without anyone re-typing addresses. This is the bulk
 * counterpart to LEO's conversational save_contact.
 *
 * PRIVACY: this only ever writes the USER'S OWN Google contacts into the USER'S OWN
 * portal. It reads nothing about other Angel OS members and never reveals whether
 * an imported email belongs to a platform account — the derived address book stays
 * membership-grained. Consent happens in Google's own UI (contacts.readonly), on
 * demand, and is NOT part of the sign-in scope. @see src/endpoints/auth-google.ts
 */
import type { Payload } from 'payload'

export interface GoogleImportResult {
  total: number
  imported: number
  updated: number
  skipped: number
}

/** Resolve the tenant to scope imported contacts into — the user's personal portal
 *  (guardian angel) so they read as "my contacts", falling back to any owned tenant. */
export async function resolveUserHomeTenant(
  payload: Payload,
  userId: number | string,
): Promise<number | string | null> {
  const owned = await payload.find({
    collection: 'tenant-memberships',
    where: { and: [{ user: { equals: userId } }, { role: { equals: 'tenant_admin' } }] },
    depth: 1,
    limit: 20,
    overrideAccess: true,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenants = (owned.docs || []).map((m: any) => m.tenant).filter((t: any) => t && typeof t === 'object')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guardian = tenants.find((t: any) => t.isGuardianAngel)
  return (guardian?.id ?? tenants[0]?.id) ?? null
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Fetch + upsert the user's Google connections. Paginates People API; caps at `max`
 * to stay well within one request budget. Never throws on a single bad row.
 */
export async function importGoogleContacts(
  payload: Payload,
  opts: { tenantId: number | string; accessToken: string; max?: number },
): Promise<GoogleImportResult> {
  const { tenantId, accessToken } = opts
  const max = opts.max ?? 2000
  const res: GoogleImportResult = { total: 0, imported: 0, updated: 0, skipped: 0 }
  const seen = new Set<string>()
  let pageToken: string | undefined

  do {
    const url = new URL('https://people.googleapis.com/v1/people/me/connections')
    url.searchParams.set('personFields', 'names,emailAddresses')
    url.searchParams.set('pageSize', '200')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!r.ok) throw new Error(`People API ${r.status}: ${(await r.text()).slice(0, 200)}`)
    const data = (await r.json()) as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connections?: any[]
      nextPageToken?: string
    }

    for (const person of data.connections ?? []) {
      const emails = Array.isArray(person.emailAddresses) ? person.emailAddresses : []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const primaryEmail = emails.find((e: any) => e?.metadata?.primary) ?? emails[0]
      const email = String(primaryEmail?.value ?? '').trim().toLowerCase()
      if (!email || !EMAIL_RE.test(email) || seen.has(email)) continue
      seen.add(email)
      res.total++

      const names = Array.isArray(person.names) ? person.names : []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const name = (names.find((n: any) => n?.metadata?.primary)?.displayName ?? names[0]?.displayName ?? '').trim() || undefined

      try {
        const existing = await payload.find({
          collection: 'contacts',
          where: { and: [{ email: { equals: email } }, { tenant: { equals: tenantId } }] },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const found = existing.docs?.[0] as { id: number | string; name?: string } | undefined
        if (found) {
          if (name && name !== found.name) {
            await payload.update({ collection: 'contacts', id: found.id, data: { name }, overrideAccess: true })
            res.updated++
          } else {
            res.skipped++
          }
        } else {
          await payload.create({
            collection: 'contacts',
            data: { email, name, source: 'api', sourceId: 'google-contacts', tenant: tenantId } as never,
            overrideAccess: true,
          })
          res.imported++
        }
      } catch {
        res.skipped++
      }

      if (res.total >= max) break
    }

    pageToken = data.nextPageToken
  } while (pageToken && res.total < max)

  return res
}
