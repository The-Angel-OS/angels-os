/**
 * Sign Constitution (all tenants) — GET /api/provision-ops/sign-constitution-all
 *
 * Rectifies tenants whose `setup.constitutionSignedAt` is null by running the
 * SAME Ed25519 federation signing flow as the `sign_constitution` LEO tool
 * (wizard step 8): get-or-create the Enterprise key pair, build a canonical
 * signing event, sign it, and persist setup.{constitutionSignedAt,
 * constitutionSignature,federationId}.
 *
 * Idempotent: a tenant already bearing constitutionSignedAt is skipped unless
 * ?force=true. Optional ?tenant=<slug> scopes to one tenant.
 *
 * operatorName = the tenant owner's name/email (owner/tenant_admin membership),
 * falling back to the tenant name. enterpriseName = tenant.name.
 *
 * Auth: super_admin OR ?key=CRON_SECRET. No schema change — setup.* fields
 * already exist on Tenants.
 */
import type { PayloadHandler } from 'payload'

export const signConstitutionAllHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(
    user && ((user as { roles?: string[] }).roles || []).includes('super_admin'),
  )
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  const tenantSlug = url.searchParams.get('tenant')
  const force = url.searchParams.get('force') === 'true'

  try {
    const { getOrCreateFederationKeyPair } = await import('@/federation/keyStore')
    const { createSigningPayload, signConstitution } = await import('@/federation/protocol')
    const { getActiveConstitution } = await import('@/federation/constitution')

    const constitution = getActiveConstitution()

    const tenantsRes = await payload.find({
      collection: 'tenants',
      where: tenantSlug ? { slug: { equals: tenantSlug } } : {},
      limit: tenantSlug ? 1 : 1000,
      depth: 0,
      overrideAccess: true,
    })
    const tenants = tenantsRes.docs as Array<{
      id: number | string
      name?: string
      slug?: string
      setup?: { constitutionSignedAt?: string | null } | null
    }>
    if (tenants.length === 0) {
      return Response.json(
        { error: tenantSlug ? `No tenant "${tenantSlug}"` : 'No tenants' },
        { status: 404 },
      )
    }

    const results: Array<{
      tenant: string | number
      status: 'signed' | 'skipped' | 'error'
      federationId?: string
      operatorName?: string
      reason?: string
    }> = []

    for (const t of tenants) {
      const already = t.setup?.constitutionSignedAt
      if (already && !force) {
        results.push({ tenant: t.slug || t.id, status: 'skipped', reason: 'already signed' })
        continue
      }

      try {
        const enterpriseName = (t.name || String(t.slug || t.id)).trim()

        // Best-effort operator: owner/tenant_admin membership → user name/email.
        let operatorName = enterpriseName
        try {
          const memRes = await payload.find({
            collection: 'tenant-memberships',
            where: {
              and: [
                { tenant: { equals: t.id } },
                { role: { in: ['tenant_admin', 'tenant_manager'] } },
              ],
            },
            limit: 1,
            depth: 1,
            overrideAccess: true,
          })
          const u = (memRes.docs?.[0] as { user?: { name?: string; email?: string } } | undefined)
            ?.user
          if (u?.name || u?.email) operatorName = (u.name || u.email) as string
        } catch {
          /* fall back to enterpriseName */
        }

        const keyPair = await getOrCreateFederationKeyPair(payload, Number(t.id))

        const signingEvent = createSigningPayload({
          enterpriseName,
          operatorName,
          domain:
            process.env.NEXT_PUBLIC_SERVER_URL ||
            `${t.slug || t.id}.${process.env.VERCEL ? 'spacesangels.com' : 'angelos.local'}`,
          constitutionVersion: constitution.version,
        })

        const sig = signConstitution(signingEvent, keyPair.privateKey)

        await payload.update({
          collection: 'tenants',
          id: t.id,
          data: {
            setup: {
              constitutionSignedAt: sig.event.signedAt,
              constitutionSignature: sig.signature.slice(0, 64),
              federationId: signingEvent.federationId,
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          overrideAccess: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          overrideLock: true as any,
        })

        results.push({
          tenant: t.slug || t.id,
          status: 'signed',
          federationId: signingEvent.federationId,
          operatorName,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        payload.logger?.error?.(`[sign-constitution-all] ${t.slug || t.id}: ${msg}`)
        results.push({ tenant: t.slug || t.id, status: 'error', reason: msg })
      }
    }

    const signed = results.filter((r) => r.status === 'signed').length
    return Response.json({
      ok: true,
      constitutionVersion: constitution.version,
      tenantsScanned: results.length,
      tenantsSigned: signed,
      results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[sign-constitution-all] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
