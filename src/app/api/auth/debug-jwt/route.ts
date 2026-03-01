/**
 * TEMPORARY diagnostic endpoint — DELETE after debugging.
 *
 * Traces through the exact same steps as Payload's JWT strategy
 * but with detailed logging at each step to identify where auth fails.
 *
 * Usage: GET /api/auth/debug-jwt?token=<jwt>
 */
import { jwtVerify } from 'jose'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const steps: Record<string, unknown> = {}

  if (!token) {
    return Response.json({ error: 'Missing ?token= parameter' }, { status: 400 })
  }

  try {
    // Step 1: Get Payload instance and check secret
    const payload = await getPayload({ config: configPromise })
    steps['1_payload_initialized'] = true
    steps['1_secret_length'] = payload.secret?.length ?? 0
    steps['1_secret_first4'] = payload.secret?.slice(0, 4) ?? '(none)'
    steps['1_env_secret_length'] = process.env.PAYLOAD_SECRET?.length ?? 0
    steps['1_env_secret_first4'] = process.env.PAYLOAD_SECRET?.slice(0, 4) ?? '(none)'
    steps['1_secrets_match'] = payload.secret === process.env.PAYLOAD_SECRET

    // Step 2: Verify JWT with the SAME key Payload uses internally
    const secretKey = new TextEncoder().encode(payload.secret)
    steps['2_secret_key_bytes'] = Array.from(secretKey.slice(0, 8))
    let decodedPayload: Record<string, unknown> = {}
    try {
      const result = await jwtVerify(token, secretKey)
      decodedPayload = result.payload as Record<string, unknown>
      steps['2_jwt_verify'] = 'SUCCESS'
      steps['2_decoded'] = decodedPayload
    } catch (verifyErr) {
      steps['2_jwt_verify'] = 'FAILED'
      steps['2_verify_error'] = String(verifyErr)
      // Also try verifying with process.env.PAYLOAD_SECRET directly
      try {
        const altKey = new TextEncoder().encode(process.env.PAYLOAD_SECRET!)
        const altResult = await jwtVerify(token, altKey)
        steps['2_alt_verify'] = 'SUCCESS (env secret works!)'
        steps['2_alt_decoded'] = altResult.payload
        decodedPayload = altResult.payload as Record<string, unknown>
      } catch (altErr) {
        steps['2_alt_verify'] = 'ALSO FAILED: ' + String(altErr)
      }
      // Return early if verification completely fails
      if (!decodedPayload.id) {
        return Response.json({ steps, diagnosis: 'JWT signature verification failed' })
      }
    }

    // Step 3: Check if collection exists in Payload
    const collectionSlug = decodedPayload.collection as string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collection = (payload.collections as any)[collectionSlug]
    steps['3_collection_slug'] = collectionSlug
    steps['3_collection_exists'] = Boolean(collection)
    steps['3_available_collections'] = Object.keys(payload.collections)
    if (!collection) {
      return Response.json({ steps, diagnosis: 'Collection not found in payload.collections' })
    }
    steps['3_auth_config'] = {
      verify: collection.config.auth?.verify,
      depth: collection.config.auth?.depth,
      tokenExpiration: collection.config.auth?.tokenExpiration,
      useSessions: collection.config.auth?.useSessions,
    }

    // Step 4: Try findByID with overrideAccess: true (same as local API default)
    const userId = decodedPayload.id
    steps['4_user_id'] = userId
    steps['4_user_id_type'] = typeof userId
    try {
      const user = await payload.findByID({
        id: userId as number,
        collection: collectionSlug as 'users',
        depth: 0,
      })
      steps['4_findByID'] = user ? 'FOUND' : 'NULL'
      if (user) {
        steps['4_user'] = {
          id: user.id,
          email: (user as any).email,
          name: (user as any).name,
          roles: (user as any).roles,
          _verified: (user as any)._verified,
          tenants: (user as any).tenants?.length,
        }
        // Step 5: Check the verify condition (same as JWT strategy line 72)
        const verifyCheck = !collection.config.auth?.verify || (user as any)._verified
        steps['5_verify_check'] = verifyCheck
        steps['5_auth_verify_setting'] = collection.config.auth?.verify ?? '(not set)'
        steps['5_user_verified'] = (user as any)._verified ?? '(not set)'

        if (verifyCheck) {
          steps['diagnosis'] = 'ALL CHECKS PASS — JWT strategy should return this user'
        } else {
          steps['diagnosis'] = 'User found but _verified check failed'
        }
      } else {
        steps['diagnosis'] = 'findByID returned null — user not found in database'
      }
    } catch (findErr) {
      steps['4_findByID'] = 'ERROR'
      steps['4_findByID_error'] = String(findErr)
      steps['diagnosis'] = 'findByID threw an exception'
    }

    // Step 6: Also try the actual /me flow — authenticate through Payload's strategy
    steps['6_note'] = 'Testing Payload auth strategy directly...'
    try {
      const meResult = await payload.find({
        collection: 'users',
        where: { id: { equals: userId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      steps['6_direct_find'] = meResult.docs.length > 0 ? 'FOUND' : 'NOT FOUND'
      if (meResult.docs[0]) {
        steps['6_user_email'] = (meResult.docs[0] as any).email
      }
    } catch (findErr) {
      steps['6_direct_find'] = 'ERROR: ' + String(findErr)
    }

    return Response.json({ steps })
  } catch (err) {
    steps['fatal_error'] = String(err)
    return Response.json({ steps }, { status: 500 })
  }
}
