/**
 * work-chapters — a Work's chapters, pages and lessons, as ROWS.
 *
 * They used to be `messages` rows carrying `metadata.kind = 'work_chapter'`,
 * filed under a channel STRING that did not exist in `channels`. That cost:
 *
 *   • no editor at all — Payload gives you one per COLLECTION, so the best a
 *     person could do was hand-edit JSON in a chat message's metadata box;
 *   • 27% of the Messages table was book content (1,245 rows, 5.5 MB);
 *   • every read had to `overrideAccess: true` to defeat space-visibility RBAC
 *     it had borrowed by accident;
 *   • `order` was a JSON key rather than a column, so serving ONE Bible page
 *     read all 1,189 chapters.
 *
 * The Work JSON interchange format, its checksum, and federation gossip are
 * untouched — `docs/planning/WORKS_AS_JSON.md` always said storage-of-record is
 * swappable behind the contract. `getWorkJson` is still the single reader.
 *
 * Two deliberate simplifications:
 *   • `image` is a URL string, not an upload relationship. The Work JSON has
 *     always carried a URL (`absMedia`), the existing rows already hold one, and
 *     a subscriber copy references the ORIGIN's media by absolute URL.
 *   • Verses stay JSON in `translations`. 1,189 chapters × 2 translations is
 *     right; 31,000 verse rows is not. A verse is not a document.
 *
 * No drafts. Works has none, chapters never had any, and drafts would double the
 * hand-written migration surface (`_work_chapters_v*`) for an editor that works
 * fine without them.
 */
import type { CollectionConfig } from 'payload'
import { canManageWork } from '@/access/canManageWork'

/** Resolve the owning tenant slug for a chapter row (by id) or a create payload. */
async function ownerFor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req: any,
  id: number | string | undefined,
  data: unknown,
): Promise<string | null> {
  let workId = (data as { work?: number | string } | undefined)?.work
  if (workId == null && id != null) {
    try {
      const row = await req.payload.findByID({ collection: 'work-chapters', id, depth: 0, overrideAccess: true })
      workId = (row as { work?: number | string })?.work
    } catch {
      return null
    }
  }
  if (workId == null) return null
  try {
    const work = await req.payload.findByID({ collection: 'works', id: workId, depth: 0, overrideAccess: true })
    return String((work as { owner?: string })?.owner ?? '') || null
  } catch {
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const manageAccess = async ({ req, id, data }: any) =>
  canManageWork(req.payload, req.user, await ownerFor(req, id, data))

export const WorkChapters: CollectionConfig = {
  slug: 'work-chapters',
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'work', 'order', 'slug', 'module', 'updatedAt'],
    description: 'Chapters, pages and lessons — the body of a Work.',
    listSearchableFields: ['title', 'slug', 'module', 'ref'],
  },
  access: {
    // The Library is read-freely, exactly like `works` itself.
    read: () => true,
    create: manageAccess,
    update: manageAccess,
    delete: manageAccess,
  },
  defaultSort: 'order',
  fields: [
    { name: 'work', type: 'relationship', relationTo: 'works', required: true, index: true,
      admin: { position: 'sidebar' } },
    { name: 'order', type: 'number', required: true, index: true,
      admin: { position: 'sidebar', description: '0-based position within the Work.' } },
    { name: 'slug', type: 'text', index: true,
      admin: { position: 'sidebar', description: 'Chapter address — the /learn/<work>/<slug> segment.' } },

    { name: 'title', type: 'text' },
    { name: 'body', type: 'code', admin: { language: 'markdown', description: 'Markdown. A ```quiz fence becomes a quiz.' } },
    { name: 'image', type: 'text', admin: { description: 'Illustration URL (absolute, or /api/media/… on this node).' } },

    // ── Course works: a lesson is a chapter with a video ─────────────────────
    { name: 'module', type: 'text', admin: { description: 'Course grouping. Chapters sharing a module render under one heading.' } },
    { name: 'video', type: 'text', admin: { description: 'Lesson video URL.' } },

    // ── Document works (case files / manifestos) ─────────────────────────────
    { type: 'collapsible', label: 'Document chapter', admin: { initCollapsed: true },
      fields: [
        { name: 'tier', type: 'text' },
        { name: 'badge', type: 'text' },
        { name: 'badgeColor', type: 'text' },
        { name: 'date', type: 'text' },
        { name: 'description', type: 'text' },
      ] },

    // ── Book works: scripture hierarchy + per-language verse arrays ──────────
    { type: 'collapsible', label: 'Book page', admin: { initCollapsed: true },
      fields: [
        { name: 'book', type: 'text' },
        { name: 'bookName', type: 'text' },
        { name: 'chapter', type: 'number' },
        { name: 'ref', type: 'text' },
        { name: 'translations', type: 'json',
          admin: { description: 'Per-language body: a markdown string, or a verse array [{ v, t }].' } },
      ] },
  ],
}
