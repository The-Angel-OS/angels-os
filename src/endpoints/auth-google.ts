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
import { getServerSideURL } from '@/utilities/getURL'
import { logError } from '@/utilities/logError'
import { resolveUserFromGoogleClaims } from '@/endpoints/googleIdentity'

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
  const statePayload: {
    redirect?: string
    origin?: string
    mode?: string
    userId?: string | number
    native?: boolean
  } = {}

  const redirectParam = url.searchParams.get('redirect')
  if (redirectParam) {
    statePayload.redirect = redirectParam
  }

  // native=1: a native app (e.g. Nimue) initiated OAuth in a system browser/Custom
  // Tab. Instead of setting a web cookie, the callback returns the JWT to the app
  // via a registered custom scheme deep link. No Google console change — Google
  // still only ever redirects to this backend's https callback.
  if (url.searchParams.get('native') === '1') {
    statePayload.native = true
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

  // Contacts import: `?contacts=1` is an ON-DEMAND consent for the People API,
  // NOT part of sign-in. It requires an already-signed-in user (like link mode)
  // and requests the contacts.readonly scope so the callback can pull the user's
  // Google contacts into their CRM. Reuses this same registered redirect URI —
  // no Google Console change needed. @see src/utilities/googleContactsImport.ts
  const wantContacts = url.searchParams.get('contacts') === '1'
  if (wantContacts) {
    if (!req.user) {
      return Response.json(
        { error: 'Sign in first to import your Google contacts.' },
        { status: 401 },
      )
    }
    statePayload.mode = 'contacts'
    statePayload.userId = req.user.id
    if (!statePayload.redirect) statePayload.redirect = '/dashboard'
  }

  // Account switching: `?switch=1` forces Google's account chooser so a signed-in
  // Google user can pick a DIFFERENT account (Nimue's "Switch account" flow — clearing
  // our Payload token alone doesn't clear Google's own browser session). Normal login
  // keeps the smoother `consent` prompt.
  const forceChooser = url.searchParams.get('switch') === '1'
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    // Contacts import needs the People API scope; sign-in keeps the minimal scope.
    scope: wantContacts
      ? 'openid email https://www.googleapis.com/auth/contacts.readonly'
      : 'openid email profile',
    access_type: 'offline',
    prompt: forceChooser ? 'select_account consent' : 'consent',
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

    const tokenData = (await tokenRes.json()) as { id_token?: string; access_token?: string }

    // ----- Contacts-import mode (NOT sign-in) -----
    // The user is already signed in and just granted contacts.readonly. Use the
    // access token to import their Google contacts into their home portal's CRM,
    // then redirect back with a result. Handled up front so none of the sign-in
    // machinery below runs for this flow.
    {
      let contactsState: { mode?: string; userId?: string | number; redirect?: string } = {}
      if (stateRaw) {
        try {
          contactsState = JSON.parse(decodeURIComponent(stateRaw))
        } catch {
          /* not JSON — ignore */
        }
      }
      if (contactsState.mode === 'contacts') {
        const returnPath =
          contactsState.redirect && contactsState.redirect.startsWith('/')
            ? contactsState.redirect
            : '/dashboard'
        const back = (q: Record<string, string>) => {
          const u = new URL(returnPath, canonicalUrl)
          for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v)
          return new Response(null, { status: 302, headers: { Location: u.toString() } })
        }
        if (!tokenData.access_token || !contactsState.userId) {
          return back({ contactsImport: 'error' })
        }
        try {
          const { importGoogleContacts, resolveUserHomeTenant } = await import(
            '@/utilities/googleContactsImport'
          )
          const tenantId = await resolveUserHomeTenant(req.payload, contactsState.userId)
          if (!tenantId) return back({ contactsImport: 'error' })
          const result = await importGoogleContacts(req.payload, {
            tenantId,
            accessToken: tokenData.access_token,
          })
          return back({
            contactsImport: 'ok',
            imported: String(result.imported),
            updated: String(result.updated),
            total: String(result.total),
          })
        } catch (e) {
          void logError({
            level: 'warning',
            source: 'oauth/google-contacts',
            message: `Google contacts import failed: ${e instanceof Error ? e.message : String(e)}`,
          })
          return back({ contactsImport: 'error' })
        }
      }
    }

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

    // ----- Find or create user + mint session/JWT (shared with federated auth) -----
    const socialEntry = {
      provider: 'google' as const,
      providerId: sub,
      email,
      displayName: name || '',
      avatarUrl: picture || '',
      linkedAt: new Date().toISOString(),
    }

    const { user, token: payloadToken } = await resolveUserFromGoogleClaims(
      req.payload,
      { email, name, sub, picture },
      req,
    )

    // ----- Parse state to determine redirect + origin domain + link mode -----
    let stateRedirect: string | undefined
    let stateOrigin: string | undefined
    let stateMode: string | undefined
    let stateLinkUserId: string | number | undefined
    let stateNative: boolean | undefined

    if (stateRaw) {
      try {
        const stateObj = JSON.parse(decodeURIComponent(stateRaw)) as {
          redirect?: string
          origin?: string
          mode?: string
          userId?: string | number
          native?: boolean
        }
        stateRedirect = stateObj.redirect
        stateOrigin = stateObj.origin
        stateMode = stateObj.mode
        stateLinkUserId = stateObj.userId
        stateNative = stateObj.native
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

        // PII-safe: log only opaque IDs, never email
        console.log('[Google OAuth] Linked Google to existing user:', {
          userId: linkUser.id,
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

    // ----- Native app sign-in: hand the JWT back via a custom-scheme deep link -----
    // Native clients (Nimue) can't use cookies cross-origin, so we return the
    // Payload JWT to the app's registered scheme. Gated to a fixed scheme to
    // prevent open redirects. The app stores it as a bearer token.
    if (stateNative) {
      const appScheme = process.env.NATIVE_APP_SCHEME || 'nimue'
      const nativeUrl = `${appScheme}://auth/callback?token=${encodeURIComponent(payloadToken)}`
      console.log('[Google OAuth] Native deep-link return:', { userId: user.id, scheme: appScheme })
      return new Response(null, {
        status: 302,
        headers: { Location: nativeUrl },
      })
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
              // `domains` is an ARRAY of {domain} rows — `domains: {contains}` is an
              // invalid path and threw "Cannot find field for path at undefined",
              // 500-ing the whole callback for any non-cookie-domain origin.
              { domain: { equals: originHostname } },
              { 'domains.domain': { equals: originHostname } },
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

    // ----- Same-domain: redirect through /api/auth/complete -----
    // Payload's handleEndpoints() reconstructs the Response object,
    // which silently drops cookies set via cookies() or Set-Cookie headers.
    // Instead, we redirect to a standalone Next.js route handler that
    // sets the cookie outside of Payload's pipeline.
    //
    // Complete on the ORIGIN host the user started from (e.g. their tenant
    // subdomain) when it's covered by COOKIE_DOMAIN — the cookie set there is
    // scoped to the apex and roams every subdomain, and the user lands back on
    // their own portal instead of stranded on canonical www. Falls back to
    // canonical for non-subdomain origins.
    let completeBase = canonicalUrl
    if (stateOrigin) {
      const originHostname = getHostname(stateOrigin)
      const cookieBase = (process.env.COOKIE_DOMAIN || '').replace(/^\./, '')
      if (cookieBase && isSubdomainOf(originHostname, cookieBase)) {
        completeBase = stateOrigin
      }
    }
    const completeUrl = new URL('/api/auth/complete', completeBase)
    completeUrl.searchParams.set('token', payloadToken)
    completeUrl.searchParams.set('redirect', redirectPath)

    // PII-safe: no email, no token in logs
    console.log('[Google OAuth] Redirecting through /api/auth/complete:', {
      userId: user.id,
      redirectPath,
    })

    return new Response(null, {
      status: 302,
      headers: { Location: completeUrl.toString() },
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred'
    // Self-catch here also defeats the global afterError net — escalate explicitly
    // so a Google sign-in outage isn't swallowed silently.
    void logError({
      level: 'warning',
      source: 'oauth/google-callback',
      message: `Google OAuth callback failed: ${message}`,
      details: err instanceof Error ? err.stack : String(err),
    })
    return Response.json({ error: message }, { status: 500 })
  }
}
