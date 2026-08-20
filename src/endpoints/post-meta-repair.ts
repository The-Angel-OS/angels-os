/**
 * Post meta repair — GET /api/post-ops/meta-repair
 *
 * `fillMetaFromContent` gives every post a share description from its own body,
 * but a beforeChange hook only fires on a save — so posts written before it
 * existed keep their blank one until someone opens and re-saves each of them.
 * That is homework, and the point of the hook was to abolish homework.
 *
 * This re-saves the posts that are missing a description, which runs them
 * through the hook. Nothing else about the document changes: it writes back the
 * SAME title and layout, so a draft stays a draft, no version is published, and
 * a post that already has a human-written description is skipped entirely.
 *
 * `?tenant=<slug>` limits it to one portal; `?dry=true` reports without writing.
 * Gated by super_admin or `?key=<CRON_SECRET>`, like the other repair endpoints.
 *
 * @see src/collections/Posts/hooks/fillMetaFromContent.ts
 */
import type { PayloadHandler } from 'payload'

export const postMetaRepairHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const isSuperAdmin = Boolean(
    user && ((user as { roles?: string[] }).roles || []).includes('super_admin'),
  )
  const keyOk = Boolean(secret && key === secret)
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  const dry = url.searchParams.get('dry') === 'true'
  const tenantSlug = url.searchParams.get('tenant')

  try {
    let tenantId: number | string | undefined
    if (tenantSlug) {
      const t = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: tenantSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      tenantId = (t.docs?.[0] as { id: number | string } | undefined)?.id
      if (tenantId == null) {
        return Response.json({ error: `No portal "${tenantSlug}"` }, { status: 404 })
      }
    }

    const res = await payload.find({
      collection: 'posts',
      where: tenantId != null ? { tenant: { equals: tenantId } } : {},
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })

    const needing = (res.docs as unknown as Array<Record<string, unknown>>).filter((d) => {
      const meta = d.meta as { description?: string } | undefined
      return !meta?.description || !String(meta.description).trim()
    })

    if (dry) {
      return Response.json({
        ok: true,
        dryRun: true,
        scanned: res.totalDocs,
        wouldFill: needing.length,
        titles: needing.slice(0, 25).map((d) => d.title),
      })
    }

    const filled: string[] = []
    const noProse: string[] = []
    const failed: string[] = []
    for (const doc of needing) {
      try {
        // Write the layout back unchanged — the hook reads it and fills the
        // description. Draft posts keep their status because we do not touch it.
        const saved = (await payload.update({
          collection: 'posts',
          id: doc.id as number,
          data: { layout: doc.layout } as never,
          overrideAccess: true,
          req,
        })) as unknown as { meta?: { description?: string } }

        // Report what ACTUALLY happened, not what was attempted. A video post
        // whose body is an embed has no prose to summarise, so the save succeeds
        // and the description stays empty — counting that as "filled" would tell
        // the operator a job was done that wasn't.
        if (saved?.meta?.description?.trim()) filled.push(String(doc.title))
        else noProse.push(String(doc.title))
      } catch (e) {
        failed.push(`${doc.title}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    return Response.json({
      ok: true,
      scanned: res.totalDocs,
      filled: filled.length,
      titles: filled,
      // These need a human sentence — there was no body text to summarise.
      needsAuthor: noProse,
      failed,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[post-meta-repair] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
