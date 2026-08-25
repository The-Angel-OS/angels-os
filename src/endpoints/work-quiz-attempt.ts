/**
 * Quiz attempt — POST /api/works-ops/quiz-attempt
 *
 * A submitted attempt is a MESSAGE in the learner's LEO DM, score in metadata.
 * No collection, no migration: the portal owner can see it, and LEO gets it for
 * free ("you scored 4/10 on the safety module — want to go back over it?").
 *
 * Body: { soulId, chapter?, title?, correct, total, answers?: number[] }
 *
 * ponytail: the CLIENT scores. An attempt here is a learning record in the
 * reader's own DM, not a proctored exam — there is nobody to cheat but yourself.
 * When grades gate something, re-read the chapter markdown server-side and score
 * from the source (parseQuiz + scoreQuiz already do it).
 */
import type { PayloadHandler } from 'payload'
import { ensureDMSpace } from '@/utilities/ensureSystemSpace'
import { findOrCreateDM } from '@/utilities/dmChannels'
import { wrapTextContent } from '@/utilities/messageContent'

export const workQuizAttemptHandler: PayloadHandler = async (req) => {
  const user = req.user as { id?: number | string } | null
  if (!user?.id) return Response.json({ error: 'auth required' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* validated below */
  }

  const soulId = typeof body.soulId === 'string' ? body.soulId.trim() : ''
  const correct = Number(body.correct)
  const total = Number(body.total)
  if (!soulId) return Response.json({ error: 'soulId is required' }, { status: 400 })
  if (!Number.isInteger(correct) || !Number.isInteger(total) || total <= 0 || correct < 0 || correct > total) {
    return Response.json({ error: 'correct and total must be integers, 0 <= correct <= total' }, { status: 400 })
  }

  const chapter = typeof body.chapter === 'string' ? body.chapter.trim() : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const answers = Array.isArray(body.answers) ? body.answers.map((a) => Number(a)) : undefined

  // Tenant from the host header, same as leo-chat — the DM space is per-tenant.
  const tenantSlug = req.headers.get('x-tenant-id') || process.env.DEFAULT_TENANT_SLUG || 'default'
  let tenantId: number | undefined
  try {
    const tenants = await req.payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = tenants.docs?.[0]?.id as number | undefined
  } catch {
    /* handled below */
  }
  if (!tenantId) return Response.json({ error: 'no tenant context' }, { status: 400 })

  const dmSpaceId = await ensureDMSpace(String(tenantId))
  if (!dmSpaceId) return Response.json({ error: 'no DM space' }, { status: 500 })

  // Thread req — this may run inside a caller's transaction, and a second
  // connection cannot see rows it has not committed yet.
  const dm = await findOrCreateDM(tenantId, dmSpaceId, user.id, 'leo', req)

  const label = title || chapter || soulId
  const text = `**Quiz — ${label}**\n\nScored ${correct}/${total}.`

  const msg = await req.payload.create({
    collection: 'messages',
    data: {
      content: wrapTextContent(text),
      space: Number(dmSpaceId),
      channel: dm.channelSlug,
      channelRef: Number(dm.channelId),
      messageType: 'system',
      author: Number(user.id),
      tenant: Number(tenantId),
      visibility: 'tenant',
      metadata: {
        kind: 'quiz_attempt',
        soulId,
        ...(chapter ? { chapter } : {}),
        ...(title ? { title } : {}),
        correct,
        total,
        ...(answers ? { answers } : {}),
      },
    } as never,
    overrideAccess: true,
    req,
  })

  return Response.json({ ok: true, messageId: msg.id, correct, total })
}
