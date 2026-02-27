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
 */
import type { PayloadHandler } from 'payload'
import { sign } from 'jsonwebtoken'
import crypto from 'crypto'

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
  const origin = url.origin

  const redirectUri = `${process.env.NEXT_PUBLIC_SERVER_URL || origin}/api/auth/google/callback`

  // Preserve the caller-supplied `redirect` query param so we can restore it
  // after Google sends the user back.
  const redirectParam = url.searchParams.get('redirect')
  const state = redirectParam
    ? encodeURIComponent(JSON.stringify({ redirect: redirectParam }))
    : undefined

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  })

  if (state) {
    params.set('state', state)
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
    const origin = url.origin

    const code = url.searchParams.get('code')
    const stateRaw = url.searchParams.get('state')

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

    const redirectUri = `${process.env.NEXT_PUBLIC_SERVER_URL || origin}/api/auth/google/callback`

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

    // ----- Decode the id_token (JWT payload — no verification needed) -----
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
          },
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
        },
        overrideAccess: true,
      })
    }

    // ----- Generate Payload-compatible JWT -----
    const payloadToken = sign(
      { id: user.id, email: user.email, collection: 'users' },
      process.env.PAYLOAD_SECRET!,
      { expiresIn: '14d' },
    )

    // ----- Build Set-Cookie header -----
    const cookieDomain = process.env.COOKIE_DOMAIN || ''
    const isProduction = process.env.NODE_ENV === 'production'
    const cookieStr = [
      `payload-token=${payloadToken}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      isProduction ? 'Secure' : '',
      cookieDomain ? `Domain=${cookieDomain}` : '',
      'Max-Age=1209600',
    ]
      .filter(Boolean)
      .join('; ')

    // ----- Determine redirect destination -----
    let redirectTo: string | undefined

    if (stateRaw) {
      try {
        const stateObj = JSON.parse(decodeURIComponent(stateRaw)) as {
          redirect?: string
        }
        if (stateObj.redirect) {
          redirectTo = stateObj.redirect
        }
      } catch {
        // state was not valid JSON — ignore
      }
    }

    if (!redirectTo) {
      const roles: string[] = Array.isArray(user.roles) ? user.roles : []
      const isAdminUser =
        roles.includes('admin') ||
        roles.includes('super_admin') ||
        roles.includes('archangel')
      redirectTo = isAdminUser ? '/admin' : '/dashboard'
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectTo,
        'Set-Cookie': cookieStr,
      },
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred'
    return Response.json({ error: message }, { status: 500 })
  }
}
