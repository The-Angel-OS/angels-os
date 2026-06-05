/**
 * Works Translate Endpoint — POST /api/works-ops/translate
 *
 *   { channelId, languages?: string[], force?: boolean }
 *
 * Auto-translates a Work draft into additional languages via the AI gateway and
 * folds them into the draft (`data.workDraft`) — the author reviews, then re-seals
 * to publish. The base language is never touched. With no `languages`, the platform
 * default set is used ("translate into the defaults"). Idempotent: languages that
 * already have content are skipped unless `force` is set.
 *
 * Works Engine slice #2.5 — the multilingual foundation. See docs/WORKS_ENGINE.md.
 */
import type { PayloadHandler } from 'payload'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { authorizeForTenant } from '@/endpoints/works-seal'
import { translateWorkDraft } from '@/utilities/worksTranslate'
import { PLATFORM_DEFAULT_LANGUAGES } from '@/config/platformLanguages'
import type { WorkDraft } from '@/utilities/worksSeal'

export const worksTranslateHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  // Translation = model calls; bound it with the conservative LEO chat bucket.
  const denied = applyRateLimit(req, 'leo_chat')
  if (denied) return denied

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const channelId = body.channelId
  if (!channelId || (typeof channelId !== 'string' && typeof channelId !== 'number')) {
    return Response.json({ error: 'channelId is required' }, { status: 400 })
  }

  const requested = Array.isArray(body.languages)
    ? (body.languages.filter((c) => typeof c === 'string') as string[])
    : null
  const force = body.force === true

  const channel = (await payload.findByID({
    collection: 'channels',
    id: channelId,
    depth: 0,
    overrideAccess: true,
  })) as { id: string | number; tenant?: string | number; data?: Record<string, unknown> } | null
  if (!channel) return Response.json({ error: 'Work not found' }, { status: 404 })

  const tenantId = channel.tenant
  if (!tenantId) return Response.json({ error: 'Work has no tenant' }, { status: 400 })
  if (!(await authorizeForTenant(payload, user, tenantId))) {
    return Response.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const data = (channel.data && typeof channel.data === 'object' ? channel.data : {}) as Record<string, unknown>
  const draft = data.workDraft as WorkDraft | undefined
  if (!draft || !Array.isArray(draft.pages) || draft.pages.length === 0) {
    return Response.json({ error: 'This work has no pages to translate' }, { status: 400 })
  }

  // Default to the platform set, minus the base language.
  const targetLangs = (requested ?? PLATFORM_DEFAULT_LANGUAGES).filter((c) => c !== draft.defaultLanguage)

  let result
  try {
    result = await translateWorkDraft(draft, { targetLangs, force })
  } catch (e) {
    payload.logger.error(`[works-translate] failed for channel ${channelId}: ${e instanceof Error ? e.message : e}`)
    return Response.json({ error: 'Translation failed. Please try again.' }, { status: 502 })
  }

  if (result.added.length > 0) {
    try {
      await payload.update({
        collection: 'channels',
        id: channel.id,
        data: { data: { ...data, workDraft: result.draft } } as never,
        overrideAccess: true,
      })
    } catch (e) {
      payload.logger.error(`[works-translate] persist failed for ${channelId}: ${e instanceof Error ? e.message : e}`)
      return Response.json({ error: 'Translated, but failed to save' }, { status: 500 })
    }
  }

  payload.logger.info(
    `[works-translate] channel ${channelId}: +${result.added.length} languages (${result.added.join(',') || 'none'})`,
  )

  return Response.json({
    success: true,
    added: result.added,
    skipped: result.skipped,
    languages: result.draft.languages.map((l) => l.code),
  })
}
