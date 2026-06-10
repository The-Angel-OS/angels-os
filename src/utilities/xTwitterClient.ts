/**
 * X (Twitter) API v2 Client
 *
 * Minimal OAuth 2.0 User-Context client for posting tweets and threads.
 * Used by `x-post` endpoint and the `post_to_x` / `post_x_thread` LEO tools.
 *
 * Requires an `x_twitter` connector with config shape:
 *   {
 *     clientId: string
 *     clientSecret: string
 *     accessToken: string
 *     refreshToken: string
 *     expiresAt: string (ISO-8601)
 *     handle: string
 *     userId: string
 *     scopes: string[]
 *   }
 *
 * Free tier: 1,500 posts / month, 50 posts / 24h per user.
 * Basic tier ($200/mo): 3,000 posts / month, 300 / 15min.
 *
 * @see https://docs.x.com/x-api/posts/creation-of-a-post
 */

import type { Payload } from 'payload'
import { logCaughtError } from './logError'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface XTwitterConfig {
  clientId: string
  clientSecret: string
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  handle?: string
  userId?: string
  scopes?: string[]
}

export interface XTweetResult {
  id: string
  text: string
  url: string
}

export interface XThreadResult {
  tweets: XTweetResult[]
  firstTweetUrl: string
}

// ─── Token Refresh ─────────────────────────────────────────────────────────

const TOKEN_URL = 'https://api.x.com/2/oauth2/token'
const POST_URL = 'https://api.x.com/2/tweets'

/**
 * Refresh an expired OAuth 2.0 access token using the refresh token.
 * Persists the new tokens back to the connector config.
 */
export async function refreshXAccessToken(
  payload: Payload,
  connectorId: string,
  cfg: XTwitterConfig,
): Promise<XTwitterConfig> {
  if (!cfg.refreshToken) {
    throw new Error('x_twitter connector missing refreshToken — re-authorize via /api/x/auth')
  }

  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: cfg.refreshToken,
    client_id: cfg.clientId,
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`X token refresh failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as {
    token_type: string
    expires_in: number
    access_token: string
    refresh_token?: string
    scope?: string
  }

  const updated: XTwitterConfig = {
    ...cfg,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || cfg.refreshToken,
    expiresAt: new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString(),
  }

  try {
    await (payload as any).update({
      collection: 'connectors',
      id: connectorId,
      data: { config: updated },
      overrideAccess: true,
    })
  } catch (err) {
    logCaughtError('xTwitterClient/persist-refresh', err)
  }

  return updated
}

/**
 * Ensure we have a fresh access token. Refreshes if within 2 minutes of expiry.
 */
export async function ensureFreshToken(
  payload: Payload,
  connectorId: string,
  cfg: XTwitterConfig,
): Promise<XTwitterConfig> {
  if (!cfg.accessToken) {
    throw new Error('x_twitter connector missing accessToken — authorize via /api/x/auth')
  }
  if (!cfg.expiresAt) return cfg

  const expiresAt = new Date(cfg.expiresAt).getTime()
  if (Number.isNaN(expiresAt)) return cfg

  if (expiresAt - Date.now() < 120_000) {
    return refreshXAccessToken(payload, connectorId, cfg)
  }
  return cfg
}

// ─── Post Tweet ────────────────────────────────────────────────────────────

interface PostTweetOptions {
  text: string
  replyToTweetId?: string
  mediaIds?: string[]
}

/**
 * Post a single tweet via X API v2.
 * Returns the tweet ID and public URL.
 */
export async function postTweet(
  cfg: XTwitterConfig,
  opts: PostTweetOptions,
): Promise<XTweetResult> {
  const text = (opts.text || '').trim()
  if (!text) throw new Error('Tweet text is required')
  if (text.length > 280) {
    throw new Error(`Tweet exceeds 280 chars (got ${text.length})`)
  }

  const body: Record<string, unknown> = { text }
  if (opts.replyToTweetId) {
    body.reply = { in_reply_to_tweet_id: opts.replyToTweetId }
  }
  if (opts.mediaIds?.length) {
    body.media = { media_ids: opts.mediaIds }
  }

  const res = await fetch(POST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`X post failed (${res.status}): ${errText}`)
  }

  const json = (await res.json()) as { data?: { id: string; text: string } }
  if (!json.data?.id) {
    throw new Error('X post succeeded but no tweet id returned')
  }

  const handle = (cfg.handle || 'i').replace(/^@/, '')
  return {
    id: json.data.id,
    text: json.data.text,
    url: `https://x.com/${handle}/status/${json.data.id}`,
  }
}

/**
 * Post a thread (array of texts) by chaining replies.
 * Returns array of tweet results in order.
 */
export async function postThread(
  cfg: XTwitterConfig,
  tweets: string[],
): Promise<XThreadResult> {
  if (!tweets.length) throw new Error('Thread must contain at least one tweet')

  const results: XTweetResult[] = []
  let replyToId: string | undefined

  for (let i = 0; i < tweets.length; i++) {
    const text = tweets[i] ?? ''
    const result = await postTweet(cfg, { text, replyToTweetId: replyToId })
    results.push(result)
    replyToId = result.id

    // Small delay between tweets to be kind to rate limits
    if (i < tweets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 800))
    }
  }

  return {
    tweets: results,
    firstTweetUrl: results[0]!.url,
  }
}
