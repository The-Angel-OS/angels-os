/**
 * Discord OAuth Endpoints
 *
 * 1. authDiscordInitHandler   — GET /api/auth/discord
 *    Redirects the user to Discord's OAuth2 consent screen.
 *
 * 2. authDiscordCallbackHandler — GET /api/auth/discord/callback
 *    Handles the OAuth2 callback, exchanges the code for tokens,
 *    finds or creates the user, sets the Payload auth cookie,
 *    and redirects to the appropriate dashboard.
 *
 * Cross-domain support:
 *    Same pattern as auth-google.ts — when a user on a custom domain
 *    initiates OAuth, the callback lands on the canonical domain, then
 *    relays the token back via /api/auth/token-relay.
 *
 * @see src/endpoints/auth-google.ts — blueprint for this implementation
 */
import type { PayloadHandler } from 'payload'
import { SignJWT } from 'jose'
import crypto from 'crypto'
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

/** Construct Discord avatar URL from user ID and avatar hash */
function getDiscordAvatarUrl(userId: string, avatarHash: string | null): string {
  if (!avatarHash) {
    // Default avatar based on user discriminator/id
    const defaultIndex = (BigInt(userId) >> BigInt(22)) % BigInt(6)
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`
  }
  const ext = avatarHash.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}`
}

// ---------------------------------------------------------------------------
// 1. Initiate Discord OAuth2 flow
// ---------------------------------------------------------------------------

export const authDiscordInitHandler: PayloadHandler = async (req) => {
  const clientId = process.env.DISCORD_CLIENT_ID

  if (!clientId) {
    return Response.json(
      { error: 'Discord authentication is not configured.' },
      { status: 501 },
    )
  }

  const url = new URL(req.url || '', 'http://localhost')
  const canonicalUrl = getServerSideURL()

  const redirectUri = `${canonicalUrl}/api/auth/discord/callback`

  // Build state: preserve caller's redirect + the origin domain for
  // cross-domain relay (custom domain tenants).
  // mode=link: linking Discord to an existing logged-in user (vs sign-in)
  const statePayload: { redirect?: string; origin?: string; mode?: string; userId?: string | number } = {}

  const redirectParam = url.searchParams.get('redirect')
  if (redirectParam) {
    statePayload.redirect = redirectParam
  }

  // Link mode: attach Discord to an existing user account
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

  // Detect if user is on a different domain than canonical
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
    scope: 'identify email guilds',
    prompt: 'consent',
  })

  if (Object.keys(statePayload).length > 0) {
    params.set('state', encodeURIComponent(JSON.stringify(statePayload)))
  }

  const discordAuthUrl = `https://discord.com/oauth2/authorize?${params.toString()}`

  return new Response(null, {
    status: 302,
    headers: { Location: discordAuthUrl },
  })
}

// ---------------------------------------------------------------------------
// 2. Discord OAuth2 callback
// ---------------------------------------------------------------------------

export const authDiscordCallbackHandler: PayloadHandler = async (req) => {
  try {
    const url = new URL(req.url || '', 'http://localhost')
    const canonicalUrl = getServerSideURL()

    const code = url.searchParams.get('code')
    const stateRaw = url.searchParams.get('state')

    console.log('[Discord OAuth] Callback received:', {
      hasCode: Boolean(code),
      hasState: Boolean(stateRaw),
      canonicalUrl,
    })

    if (!code) {
      return Response.json(
        { error: 'Missing authorization code from Discord.' },
        { status: 400 },
      )
    }

    const clientId = process.env.DISCORD_CLIENT_ID
    const clientSecret = process.env.DISCORD_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return Response.json(
        { error: 'Discord authentication is not configured.' },
        { status: 501 },
      )
    }

    const redirectUri = `${canonicalUrl}/api/auth/discord/callback`

    // ----- Exchange code for access token -----
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
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

    const tokenData = (await tokenRes.json()) as { access_token?: string; token_type?: string }

    if (!tokenData.access_token) {
      return Response.json(
        { error: 'No access_token received from Discord.' },
        { status: 502 },
      )
    }

    // ----- Fetch Discord user profile -----
    const profileRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!profileRes.ok) {
      return Response.json(
        { error: 'Failed to fetch Discord user profile.' },
        { status: 502 },
      )
    }

    const profile = (await profileRes.json()) as {
      id: string
      username: string
      global_name?: string | null
      email?: string | null
      avatar?: string | null
      discriminator?: string
    }

    const { id: discordId, username, global_name, email, avatar } = profile

    if (!discordId) {
      return Response.json(
        { error: 'Discord profile missing required user ID.' },
        { status: 502 },
      )
    }

    const displayName = global_name || username || ''
    const avatarUrl = getDiscordAvatarUrl(discordId, avatar ?? null)

    // ----- Find or create user -----
    const socialEntry = {
      provider: 'discord' as const,
      providerId: discordId,
      email: email || '',
      displayName,
      avatarUrl,
      linkedAt: new Date().toISOString(),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let user: any

    // ----- Parse state early (needed for link mode) -----
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

    // ----- Link mode: attach Discord to existing user instead of sign-in -----
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
          (p: any) => p.provider === 'discord' && p.providerId === discordId,
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

        console.log('[Discord OAuth] Linked Discord to existing user:', {
          userId: linkUser.id,
          email: linkUser.email,
          discordId,
          discordUsername: username,
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

    // ----- Sign-in mode: find or create user -----
    // Try to find by email first (if Discord provided one)
    if (email) {
      const existing = await req.payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
        overrideAccess: true,
      })

      if (existing.docs.length > 0) {
        user = existing.docs[0]

        // Ensure the Discord provider entry exists in socialProviders
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const providers: any[] = Array.isArray(user.socialProviders)
          ? user.socialProviders
          : []

        const alreadyLinked = providers.some(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) => p.providerId === discordId,
        )

        if (!alreadyLinked) {
          await req.payload.update({
            collection: 'users',
            id: user.id,
            data: {
              socialProviders: [...providers, socialEntry],
            } as any,
            overrideAccess: true,
          })
        }
      }
    }

    // Try finding by Discord provider ID (user may not have email from Discord)
    if (!user) {
      const byProvider = await req.payload.find({
        collection: 'users',
        where: {
          'socialProviders.providerId': { equals: discordId },
        },
        limit: 1,
        overrideAccess: true,
      })

      if (byProvider.docs.length > 0) {
        user = byProvider.docs[0]
      }
    }

    // Create new user
    if (!user) {
      // Discord email may not be available — generate a synthetic one if needed
      const userEmail = email || `discord-${discordId}@oauth.angel-os.local`

      user = await req.payload.create({
        collection: 'users',
        data: {
          email: userEmail,
          name: displayName || username,
          password: crypto.randomUUID() + crypto.randomUUID(),
          roles: ['customer'],
          socialProviders: [socialEntry],
        } as any,
        overrideAccess: true,
      })
    }

    console.log('[Discord OAuth] User resolved:', {
      userId: user.id,
      email: user.email,
      discordId,
      discordUsername: username,
    })

    // ----- Generate Payload-compatible JWT -----
    // MUST use jose (same library as Payload CMS 3.x) — jsonwebtoken encodes
    // the secret differently and produces signatures Payload cannot verify.
    const secretKey = new TextEncoder().encode(process.env.PAYLOAD_SECRET!)
    const issuedAt = Math.floor(Date.now() / 1000)
    const expiration = issuedAt + 14 * 24 * 60 * 60 // 14 days

    const payloadToken = await new SignJWT({ id: user.id, email: user.email, collection: 'users' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiration)
      .sign(secretKey)

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
    if (stateOrigin) {
      const originHostname = getHostname(stateOrigin)
      const canonicalHostname = getHostname(canonicalUrl)
      const cookieDomain = process.env.COOKIE_DOMAIN || ''
      const cookieBase = cookieDomain.startsWith('.') ? cookieDomain.slice(1) : cookieDomain

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
          const relayUrl = `${stateOrigin}/api/auth/token-relay?t=${encodeURIComponent(payloadToken)}&r=${encodeURIComponent(redirectPath)}`
          return new Response(null, {
            status: 302,
            headers: { Location: relayUrl },
          })
        }
      }
    }

    // ----- Same-domain: redirect through /api/auth/complete -----
    // Payload's handleEndpoints() reconstructs the Response object,
    // which silently drops cookies set via cookies() or Set-Cookie headers.
    // Instead, we redirect to a standalone Next.js route handler that
    // sets the cookie outside of Payload's pipeline.
    const completeUrl = new URL('/api/auth/complete', canonicalUrl)
    completeUrl.searchParams.set('token', payloadToken)
    completeUrl.searchParams.set('redirect', redirectPath)

    console.log('[Discord OAuth] Redirecting through /api/auth/complete:', {
      userId: user.id,
      email: user.email,
      redirectPath,
      completeUrl: completeUrl.toString(),
    })

    return new Response(null, {
      status: 302,
      headers: { Location: completeUrl.toString() },
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred'
    return Response.json({ error: message }, { status: 500 })
  }
}
