/**
 * Media → AI Bus Hook — afterChange on Media (create only).
 *
 * THE INVARIANT: every new media asset gets a channel message. No image exists
 * in the store without a corresponding entry in the observable message flow — so
 * you can open the AI Bus `media` channel in Spaces and watch uploads, Nimue
 * camera frames, and BOLO sentinel captures stream past in real time, with the
 * image rendered inline (via the message's attachments) and the media id in
 * metadata for tracing. The Media collection itself can hold thousands and stays
 * behind its filters; the flow is the timeline.
 *
 * Fire-and-forget (setImmediate) so the upload response never waits. Fail-soft —
 * a bus post must never break an upload. Self-healing: finds-or-creates the
 * `media` channel on the tenant's AI Bus, cached per space so existing tenants
 * get the channel without a seed migration.
 *
 * @see src/utilities/escalationToAiBus.ts — the sibling "post a system message" pattern
 * @see src/collections/Media/hooks/autoAnalyzeUpload.ts — the analysis twin
 */
import type { CollectionAfterChangeHook, Payload, PayloadRequest } from 'payload'
import { resolveAiBusSpaceId } from '@/utilities/ensureSystemSpace'
import { wrapTextContent } from '@/utilities/messageContent'

const MEDIA_CHANNEL_SLUG = 'media'

/** Spaces already confirmed to have a `media` channel — avoids a lookup per upload. */
const spacesWithMediaChannel = new Set<string>()

/** Reset the per-space channel cache — TESTS ONLY. */
export function __resetMediaToAiBusState(): void {
  spacesWithMediaChannel.clear()
}

/** Find-or-create the `media` channel on a space; cached after first success. */
async function ensureMediaChannel(
  payload: Payload,
  req: PayloadRequest,
  spaceId: number | string,
  tenantId: number | string,
): Promise<boolean> {
  const key = String(spaceId)
  if (spacesWithMediaChannel.has(key)) return true
  try {
    const existing = await payload.find({
      collection: 'channels',
      where: { and: [{ space: { equals: spaceId } }, { slug: { equals: MEDIA_CHANNEL_SLUG } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs?.length === 0) {
      await payload.create({
        collection: 'channels',
        data: {
          name: 'Media',
          slug: MEDIA_CHANNEL_SLUG,
          description:
            'Every new media asset lands here — uploads, Nimue camera, BOLO sentinel frames. The observable media flow.',
          type: 'general',
          space: spaceId,
          isDefault: false,
          tenant: tenantId,
        } as never,
        req,
        overrideAccess: true,
      })
    }
    spacesWithMediaChannel.add(key)
    return true
  } catch {
    return false
  }
}

/** Find a system author (LEO) for the tenant, falling back to user id 1. */
async function resolveAuthor(payload: Payload, tenantId: number | string): Promise<number> {
  try {
    const leo = await payload.find({
      collection: 'users',
      where: {
        and: [{ servesTenant: { equals: tenantId } }, { 'agentConfig.agentType': { equals: 'leo' } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const id = leo.docs?.[0]?.id
    if (typeof id === 'number') return id
  } catch {
    /* fall through */
  }
  return 1
}

export const mediaToAiBus: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc

  const tenantId =
    typeof doc.tenant === 'object' && doc.tenant ? (doc.tenant as { id?: unknown }).id : doc.tenant
  if (tenantId == null) return doc // untenanted media (rare) — nothing to observe against

  const payload = req.payload
  const mediaId = doc.id

  setImmediate(async () => {
    try {
      const spaceId = await resolveAiBusSpaceId(payload as never, tenantId)
      if (!spaceId) return
      if (!(await ensureMediaChannel(payload, req, spaceId, tenantId))) return

      const author = await resolveAuthor(payload, tenantId)
      const filename = (doc.filename as string) || (doc.alt as string) || `media #${mediaId}`
      const mime = (doc.mimeType as string) || ''
      const emoji = mime.startsWith('image/') ? '🖼️' : mime.startsWith('video/') ? '🎞️' : '📎'

      await payload.create({
        collection: 'messages',
        data: {
          content: wrapTextContent(`${emoji} New media: **${filename}**`),
          space: Number(spaceId),
          channel: MEDIA_CHANNEL_SLUG,
          messageType: 'system',
          author,
          tenant: Number(tenantId),
          visibility: 'tenant',
          // Number() — the attachments `media` relationship's filterOptions compares
          // in JS, so a string id fails "invalid: Attachments 1 > Media".
          attachments: [{ media: Number(mediaId) }],
          metadata: {
            kind: 'media_created',
            mediaId,
            mimeType: mime,
            filename,
          },
        } as never,
        req,
        overrideAccess: true,
      })
    } catch (err) {
      payload.logger?.warn?.(
        `[mediaToAiBus] failed to post media ${mediaId}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  })

  return doc
}
