/**
 * Google OAuth Endpoints
 *
 * 1. authGoogleInitHandler   — GET /api/auth/google
 *    Redirects the user to Google's OAuth2 consent screen.
 *
 * 2. authGoogleCallbackHandler — GET /api/auth/google/callback
 *    Handles the OAuth2 callback, exchanges the code for tokens,
 *    finds or creates the user, sets the Payload auth cookie,
 *    and redirects to the appropriate dashboard.
 *
 * Cross-domain support:
 *    When a user on a custom domain (kendev.co) initiates OAuth, the
 *    callback always lands on the canonical domain (NEXT_PUBLIC_SERVER_URL)
 *    because only one redirect URI is registered with Google. The origin
 *    domain is encoded in the OAuth `state` parameter. If it differs from
 *    the canonical domain (and isn't covered by COOKIE_DOMAIN), we redirect
 *    through /api/auth/token-relay on the origin domain to set the cookie.
 */
import type { PayloadHandler } from 'payload'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { cookies as getCookies } from 'next/headers'
import { getServerSideURL } from '@/utilities/getURL'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract hostname from a URL string, stripping port */
function getHostname(urlStr: string): string {
  try {
    return new URL(urlStr).hostname
  } catch {
    return ''
  }
}

/** Check if a hostname is a subdomain of another (or equal) */
function isSubdomainOf(hostname: string, parent: string): boolean {
  return hostname === parent || hostname.endsWith(`.${parent}`)
}

// ---------------------------------------------------------------------------
// 1. Initiate Google OAuth2 flow
// ---------------------------------------------------------------------------

export const authGoogleInitHandler: PayloadHandler = async (req) => {
  const clientId = process.env.GOOGLE_CLIENT_ID

  if (!clientId) {
    return Response.json(
      { error: 'Google authentication is not configured.' },
      { status: 501 },
    )
  }

  const url = new URL(req.url || '', 'http://localhost')
  const canonicalUrl = getServerSideURL()

  const redirectUri = `${canonicalUrl}/api/auth/google/callback`

  // Build state: preserve caller's redirect + the origin domain for
  // cross-domain relay (custom domain tenants).
  // mode=link: linking Google to an existing logged-in user (vs sign-in)
  const statePayload: { redirect?: string; origin?: string; mode?: string; userId?: string | number } = {}

  const redirectParam = url.searchParams.get('redirect')
  if (redirectParam) {
    statePayload.redirect = redirectParam
  }

  // Link mode: attach Google to an existing user account
  const mode = url.searchParams.get('mode')
  if (mode === 'link') {
    // Require authentication — we need to know which user to link to
    if (!req.user) {
      return Response.json(
        { error: 'Authentication required to link a social provider.' },
        { status: 401 },
      )
    }
    statePayload.mode = 'link'
    statePayload.userId = req.user.id
    // Default redirect back to account page after linking
    if (!statePayload.redirect) {
      statePayload.redirect = '/account'
    }
  }

  // If the user is on a different domain than canonical, record it.
  // NOTE: url.origin is unreliable in serverless (resolves to 'http://localhost').
  // Use forwarded headers to detect the actual request origin.
  const hostHeader = req.headers?.get?.('x-forwarded-host') || req.headers?.get?.('host') || ''
  const protoHeader = req.headers?.get?.('x-forwarded-proto') || 'https'
  const currentOrigin = hostHeader ? `${protoHeader}://${hostHeader}` : canonicalUrl
  if (getHostname(currentOrigin) !== getHostname(canonicalUrl)) {
    statePayload.origin = currentOrigin
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  })

  if (Object.keys(statePayload).length > 0) {
    params.set('state', encodeURIComponent(JSON.stringify(statePayload)))
  }

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  return new Response(null, {
    status: 302,
    headers: { Location: googleAuthUrl },
  })
}

// ---------------------------------------------------------------------------
// 2. Google OAuth2 callback
// ---------------------------------------------------------------------------

export const authGoogleCallbackHandler: PayloadHandler = async (req) => {
  try {
    const url = new URL(req.url || '', 'http://localhost')
    const canonicalUrl = getServerSideURL()

    const code = url.searchParams.get('code')
    const stateRaw = url.searchParams.get('state')

    console.log('[Google OAuth] Callback received:', {
      hasCode: Boolean(code),
      hasState: Boolean(stateRaw),
      canonicalUrl,
    })

    if (!code) {
      return Response.json(
        { error: 'Missing authorization code from Google.' },
        { status: 400 },
      )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return Response.json(
        { error: 'Google authentication is not configured.' },
        { status: 501 },
      )
    }

    const redirectUri = `${canonicalUrl}/api/auth/google/callback`

    // ----- Exchange code for tokens -----
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      return Response.json(
        { error: 'Failed to exchange code for tokens.', details: errBody },
        { status: 502 },
      )
    }

    const tokenData = (await tokenRes.json()) as { id_token?: string }

    if (!tokenData.id_token) {
      return Response.json(
        { error: 'No id_token received from Google.' },
        { status: 502 },
      )
    }

    // ----- Decode the id_token (JWT — Google-signed, not secret) -----
    const payloadSegment = tokenData.id_token.split('.')[1]
    if (!payloadSegment) {
      return Response.json(
        { error: 'Malformed id_token from Google.' },
        { status: 502 },
      )
    }

    const decoded = JSON.parse(
      Buffer.from(payloadSegment, 'base64').toString('utf-8'),
    ) as {
      email?: string
      name?: string
      sub?: string
      picture?: string
    }

    const { email, name, sub, picture } = decoded

    if (!email || !sub) {
      return Response.json(
        { error: 'Google token missing required claims (email, sub).' },
        { status: 502 },
      )
    }

    // ----- Find or create user -----
    const socialEntry = {
      provider: 'google' as const,
      providerId: sub,
      email,
      displayName: name || '',
      avatarUrl: picture || '',
      linkedAt: new Date().toISOString(),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let user: any

    const existing = await req.payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      user = existing.docs[0]

      // Ensure the Google provider entry exists in socialProviders
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const providers: any[] = Array.isArray(user.socialProviders)
        ? user.socialProviders
        : []

      const alreadyLinked = providers.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => p.providerId === sub,
      )

      if (!alreadyLinked) {
        await req.payload.update({
          collection: 'users',
          id: user.id,
          data: {
            socialProviders: [...providers, socialEntry],
          } as any, // socialProviders not yet in generated types
          overrideAccess: true,
        })
      }
    } else {
      // Create a new user with a random unguessable password
      user = await req.payload.create({
        collection: 'users',
        data: {
          email,
          name: name || '',
          password: crypto.randomUUID() + crypto.randomUUID(),
          roles: ['customer'],
          socialProviders: [socialEntry],
        } as any, // socialProviders not yet in generated types
        overrideAccess: true,
      })
    }

    console.log('[Google OAuth] User resolved:', {
      userId: user.id,
      email: user.email,
      isNew: existing.docs.length === 0,
      roles: user.roles,
    })

    // ----- Generate Payload-compatible JWT -----
    const payloadToken = jwt.sign(
      { id: user.id, email: user.email, collection: 'users' },
      process.env.PAYLOAD_SECRET!,
      { expiresIn: '14d' },
    )

    // ----- Parse state to determine redirect + origin domain + link mode -----
    let stateRedirect: string | undefined
    let stateOrigin: string | undefined
    let stateMode: string | undefined
    let stateLinkUserId: string | number | undefined

    if (stateRaw) {
      try {
        const stateObj = JSON.parse(decodeURIComponent(stateRaw)) as {
          redirect?: string
          origin?: string
          mode?: string
          userId?: string | number
        }
        stateRedirect = stateObj.redirect
        stateOrigin = stateObj.origin
        stateMode = stateObj.mode
        stateLinkUserId = stateObj.userId
      } catch {
        // state was not valid JSON — ignore
      }
    }

    // ----- Link mode: attach Google to existing user instead of sign-in -----
    if (stateMode === 'link' && stateLinkUserId) {
      const linkUser = await req.payload.findByID({
        collection: 'users',
        id: stateLinkUserId,
        overrideAccess: true,
      })

      if (linkUser) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingProviders: any[] = Array.isArray((linkUser as any).socialProviders)
          ? (linkUser as any).socialProviders
          : []

        const alreadyLinked = existingProviders.some(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) => p.provider === 'google' && p.providerId === sub,
        )

        if (!alreadyLinked) {
          await req.payload.update({
            collection: 'users',
            id: linkUser.id,
            data: {
              socialProviders: [...existingProviders, socialEntry],
            } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            overrideAccess: true,
          })
        }

        console.log('[Google OAuth] Linked Google to existing user:', {
          userId: linkUser.id,
          email: linkUser.email,
          googleEmail: email,
        })

        // Redirect back — user is already authenticated, no new JWT needed
        const redirectPath = stateRedirect || '/account'
        const canonicalRedirect = new URL(redirectPath, canonicalUrl).toString()
        return new Response(null, {
          status: 302,
          headers: { Location: canonicalRedirect },
        })
      }
    }

    // Determine final in-app redirect path
    let redirectPath: string
    if (stateRedirect && stateRedirect.startsWith('/')) {
      redirectPath = stateRedirect
    } else {
      const roles: string[] = Array.isArray(user.roles) ? user.roles : []
      const isAdminUser =
        roles.includes('admin') ||
        roles.includes('super_admin') ||
        roles.includes('archangel')
      redirectPath = isAdminUser ? '/admin' : '/dashboard'
    }

    // ----- Cross-domain relay for custom domain tenants -----
    // If the user initiated OAuth from a different domain, relay the token
    // back to that domain so the cookie gets set on the correct host.
    if (stateOrigin) {
      const originHostname = getHostname(stateOrigin)
      const canonicalHostname = getHostname(canonicalUrl)
      const cookieDomain = process.env.COOKIE_DOMAIN || ''
      const cookieBase = cookieDomain.startsWith('.') ? cookieDomain.slice(1) : cookieDomain

      // If the origin is a subdomain of COOKIE_DOMAIN, the cookie set on
      // the canonical domain already covers it — no relay needed.
      const coveredByCookie = cookieBase && isSubdomainOf(originHostname, cookieBase)

      if (!coveredByCookie && originHostname !== canonicalHostname) {
        // Validate the origin is a known tenant domain (prevents open redirect)
        const tenantCheck = await req.payload.find({
          collection: 'tenants',
          where: {
            or: [
              { domains: { contains: originHostname } },
              { slug: { equals: originHostname.split('.')[0] } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (tenantCheck.docs.length > 0) {
          // Relay token to the custom domain
          const relayUrl = `${stateOrigin}/api/auth/token-relay?t=${encodeURIComponent(payloadToken)}&r=${encodeURIComponent(redirectPath)}`
          return new Response(null, {
            status: 302,
            headers: { Location: relayUrl },
          })
        }
        // Unknown domain — fall through to canonical cookie (safe default)
      }
    }

    // ----- Same-domain: set cookie via Next.js cookies() API -----
    // This matches how Payload itself sets auth cookies internally
    // (via @payloadcms/next setPayloadAuthCookie). The cookies() API
    // from next/headers uses AsyncLocalStorage to register cookie
    // operations, which Next.js then merges into the outgoing response.
    // This bypasses any issues with Set-Cookie headers being lost
    // during Payload's handleEndpoints() Response reconstruction.
    const absoluteRedirect = new URL(redirectPath, canonicalUrl).toString()
    const cookieName = `${req.payload.config.cookiePrefix}-token`
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined
    const isProduction = process.env.NODE_ENV === 'production'

    console.log('[Google OAuth] Setting cookie via cookies() API and redirecting:', {
      userId: user.id,
      email: user.email,
      redirectPath,
      absoluteRedirect,
      cookieName,
      cookieDomain: cookieDomain || '(current host)',
      isProduction,
    })

    try {
      const cookieStore = await getCookies()
      cookieStore.set(cookieName, payloadToken, {
        domain: cookieDomain,
        expires: new Date(Date.now() + 1209600 * 1000), // 14 days
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        path: '/',
      })
    } catch (cookieErr) {
      console.error('[Google OAuth] cookies() API failed, falling back to Set-Cookie header:', cookieErr)
      // Fallback: set cookie via Set-Cookie header
      const cookieParts = [
        `${cookieName}=${payloadToken}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        ...(isProduction ? ['Secure'] : []),
        ...(cookieDomain ? [`Domain=${cookieDomain}`] : []),
        'Max-Age=1209600',
      ]
      return new Response(null, {
        status: 302,
        headers: {
          Location: absoluteRedirect,
          'Set-Cookie': cookieParts.join('; '),
        },
      })
    }

    return new Response(null, {
      status: 302,
      headers: { Location: absoluteRedirect },
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred'
    return Response.json({ error: message }, { status: 500 })
  }
}
