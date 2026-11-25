/**
 * OAuth 2.1 PKCE Endpoints for Sovereign Remote MCP
 *
 *   - GET  /api/mcp-oauth/authorize  — Authorization Code + PKCE S256 grant
 *   - POST /api/mcp-oauth/token      — Exchange authorization code + code_verifier for `aos_live_` Bearer token
 *   - POST /api/mcp-oauth/revoke     — RFC 7009 instant token revocation
 *
 * Security invariants:
 *   - Requires S256 PKCE (`code_challenge_method=S256`)
 *   - Only allows HTTPS redirect URIs (or `http://localhost` / `http://127.0.0.1` for local dev clients)
 *   - Pins issued token strictly to the portal resolved from the request host (`resolveTenantFromHeaders`)
 *     and verifies active `tenant_admin` / `tenant_manager` (or `super_admin`) standing.
 */
import type { PayloadHandler } from 'payload'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { getUserTenantRoles } from '@/access/getUserTenantRoles'
import {
  createOAuthAuthorizationCode,
  exchangeOAuthCodeForToken,
  normalizeScopes,
  parsePortalApiKey,
  revokePortalApiKey,
} from '@/lib/mcp/sovereignAuth'

const MANAGER_ROLES = new Set(['tenant_admin', 'tenant_manager'])

export function isAllowedRedirectUri(rawUri: string): boolean {
  try {
    const parsed = new URL(rawUri)
    if (parsed.protocol === 'https:') return true
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}

async function authorizePortalManager(req: Parameters<PayloadHandler>[0]) {
  const { user, payload } = req
  if (!user?.id) {
    return { error: Response.json({ error: 'unauthorized', error_description: 'Sign in as a portal manager to authorize MCP access.' }, { status: 401 }) }
  }
  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) {
    return { error: Response.json({ error: 'invalid_request', error_description: 'No portal context for this host.' }, { status: 400 }) }
  }
  if (checkRole(ADMIN_ROLES, user)) {
    return { tenantId: Number(tenantId), userId: Number(user.id), payload }
  }
  const roles = await getUserTenantRoles(user.id)
  const ok = roles.some((m) => {
    const t = m.tenant as unknown
    const id = typeof t === 'object' && t !== null ? (t as { id: number | string }).id : t
    return String(id) === String(tenantId) && MANAGER_ROLES.has(m.role || '')
  })
  if (!ok) {
    return {
      error: Response.json(
        { error: 'access_denied', error_description: 'Only portal managers can authorize external MCP clients.' },
        { status: 403 },
      ),
    }
  }
  return { tenantId: Number(tenantId), userId: Number(user.id), payload }
}

/**
 * GET /api/mcp-oauth/authorize
 */
export const mcpOAuthAuthorizeHandler: PayloadHandler = async (req) => {
  const url = new URL(req.url || 'https://spacesangels.com/api/mcp-oauth/authorize')
  const responseType = url.searchParams.get('response_type') || ''
  const clientId = (url.searchParams.get('client_id') || '').trim()
  const redirectUri = (url.searchParams.get('redirect_uri') || '').trim()
  const scopeParam = url.searchParams.get('scope') || 'portal:read'
  const state = url.searchParams.get('state') || ''
  const codeChallenge = (url.searchParams.get('code_challenge') || '').trim()
  const codeChallengeMethod = (url.searchParams.get('code_challenge_method') || '').trim()

  if (responseType !== 'code') {
    return Response.json(
      { error: 'unsupported_response_type', error_description: 'Only response_type=code is supported.' },
      { status: 400 },
    )
  }
  if (!clientId || !redirectUri || !isAllowedRedirectUri(redirectUri)) {
    return Response.json(
      { error: 'invalid_request', error_description: 'Valid client_id and HTTPS (or localhost) redirect_uri are required.' },
      { status: 400 },
    )
  }
  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return Response.json(
      { error: 'invalid_request', error_description: 'OAuth 2.1 requires PKCE with code_challenge_method=S256.' },
      { status: 400 },
    )
  }

  // If unauthenticated browser visits authorize, bounce to /login with return redirect
  if (!req.user?.id) {
    const returnTo = `${url.pathname}${url.search}`
    const loginUrl = new URL('/login', url.origin)
    loginUrl.searchParams.set('redirect', returnTo)
    return Response.redirect(loginUrl.toString(), 302)
  }

  const auth = await authorizePortalManager(req)
  if ('error' in auth && auth.error) return auth.error

  const scopes = normalizeScopes(scopeParam)
  const { code } = await createOAuthAuthorizationCode(auth.payload, {
    tenantId: auth.tenantId,
    ownerUserId: auth.userId,
    clientId,
    redirectUri,
    codeChallenge,
    scopes,
  })

  const target = new URL(redirectUri)
  target.searchParams.set('code', code)
  if (state) target.searchParams.set('state', state)

  return Response.redirect(target.toString(), 302)
}

/**
 * POST /api/mcp-oauth/token
 * Accepts both application/x-www-form-urlencoded (OAuth 2.1 standard) and application/json.
 */
export const mcpOAuthTokenHandler: PayloadHandler = async (req) => {
  let params: Record<string, string> = {}
  const contentType = req.headers.get('content-type') || ''

  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text?.()
      const sp = new URLSearchParams(text || '')
      sp.forEach((v, k) => {
        params[k] = v
      })
    } else {
      const json = (await req.json?.()) as Record<string, unknown> | undefined
      if (json && typeof json === 'object') {
        for (const [k, v] of Object.entries(json)) {
          if (typeof v === 'string') params[k] = v
        }
      }
    }
  } catch {
    return Response.json(
      { error: 'invalid_request', error_description: 'Could not parse token request body.' },
      { status: 400 },
    )
  }

  const grantType = params.grant_type || ''
  if (grantType !== 'authorization_code') {
    return Response.json(
      { error: 'unsupported_grant_type', error_description: 'Only grant_type=authorization_code is supported.' },
      { status: 400 },
    )
  }

  const code = params.code || ''
  const codeVerifier = params.code_verifier || ''
  const clientId = params.client_id || ''
  const redirectUri = params.redirect_uri || ''

  if (!code || !codeVerifier || !clientId || !redirectUri) {
    return Response.json(
      { error: 'invalid_request', error_description: 'code, code_verifier, client_id, and redirect_uri are required.' },
      { status: 400 },
    )
  }

  const exchanged = await exchangeOAuthCodeForToken(req.payload, {
    code,
    codeVerifier,
    clientId,
    redirectUri,
  })

  if (!exchanged.ok) {
    return Response.json(
      { error: exchanged.error, error_description: exchanged.errorDescription },
      { status: 400 },
    )
  }

  return Response.json(
    {
      access_token: exchanged.accessToken,
      token_type: 'Bearer',
      scope: exchanged.scope,
      tenant_id: exchanged.tenantId,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    },
  )
}

/**
 * POST /api/mcp-oauth/revoke — RFC 7009 token revocation
 */
export const mcpOAuthRevokeHandler: PayloadHandler = async (req) => {
  let token = ''
  const contentType = req.headers.get('content-type') || ''
  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const sp = new URLSearchParams((await req.text?.()) || '')
      token = sp.get('token') || ''
    } else {
      const json = (await req.json?.()) as Record<string, unknown> | undefined
      token = typeof json?.token === 'string' ? json.token : ''
    }
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = parsePortalApiKey(token)
  if (parsed) {
    await revokePortalApiKey(req.payload, parsed.tenantId, parsed.raw)
  }
  // Per RFC 7009 §2.2, return 200 OK even if the token was unknown or already revoked
  return Response.json({ ok: true })
}
