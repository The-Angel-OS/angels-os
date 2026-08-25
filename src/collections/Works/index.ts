/**
 * Works — the Library catalog (manifest handle), Phase 1 of Works-as-JSON.
 *
 * A slim catalog record per Work: the manifest + canonical/owner/subscribers +
 * a pointer to its storage-of-record. The CONTENT (chapters) does NOT live here
 * yet — it stays in the file-based souls (the reader's fallback) until Phase 2
 * materializes chapters as messages. So this collection is additive and inert:
 * nothing reads or writes it yet, the file reader is untouched.
 *
 * Federation-portable by design: owner/subscribers are tenant SLUGS (stable
 * across nodes) not relationship ids (which differ per node). Array/group-ish
 * fields (tags, canonical, subscribers, storageRef) are `json` so there are NO
 * sub-tables to hand-roll on prod — see ensure-works-table + the rule in
 * docs/architecture/* about never hand-rolling Payload array tables.
 *
 * @see docs/planning/WORKS_AS_JSON.md  @see src/endpoints/ensure-works-table.ts
 */
import type { CollectionConfig } from 'payload'

export const Works: CollectionConfig = {
  slug: 'works',
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'owner', 'checksum', 'updatedAt'],
    listSearchableFields: ['title', 'slug', 'subtitle', 'description', 'owner', 'checksum'],
    description: 'The Library catalog — one record per Work (the manifest handle).',
  },
  access: {
    // The Library is read-freely; writes are gated (owner-tenant rules come in Phase 4).
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    // Works carry tenant SLUGS rather than a tenant relationship, so there is
    // nothing to scope a filter against yet (owner-tenant rules are Phase 4).
    // Until then admin-only: `Boolean(user)` let any signed-in account rewrite
    // the Library's text. Importers/LEO tools use overrideAccess and are
    // unaffected.
    update: ({ req: { user } }) =>
      Boolean(user && ((user as { roles?: string[] }).roles ?? []).some((r) => ['super_admin', 'admin', 'archangel'].includes(r))),
    delete: ({ req: { user } }) => {
      const roles = (user as { roles?: string[] } | null)?.roles ?? []
      return roles.includes('super_admin') || roles.includes('admin')
    },
  },
  fields: [
    { name: 'slug', type: 'text', required: true, index: true,
      admin: { description: 'Stable Work id, e.g. "answer53" — matches the file-based soul id during migration.' } },
    { name: 'title', type: 'text', required: true },
    { name: 'subtitle', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'type', type: 'select', defaultValue: 'document', index: true,
      options: [
        { label: 'Document (case file / manifesto)', value: 'document' },
        { label: 'Book (illustrated, paged)', value: 'book' },
        { label: 'Course (modules and lessons)', value: 'course' },
      ] },
    { name: 'status', type: 'text' },
    { name: 'statusColor', type: 'text' },
    { name: 'tags', type: 'json', admin: { description: 'string[] of tags.' } },
    { name: 'canonical', type: 'json',
      admin: { description: 'Publish-once-canonical: { origin, creditedTo?, contributors?[] }.' } },
    { name: 'owner', type: 'text', index: true,
      admin: { description: 'Owning/editable endeavor — tenant SLUG (federation-stable, not an id).' } },
    { name: 'subscribers', type: 'json',
      admin: { description: 'string[] of subscriber tenant slugs (additional endeavors that carry a copy).' } },
    { name: 'published', type: 'checkbox', defaultValue: false, index: true,
      admin: { description: 'Shown on public Library indexes. Unpublished Works stay editable working copies, reachable by direct link.' } },
    { name: 'availableGlobally', type: 'checkbox', defaultValue: false,
      admin: { description: 'Offered to EVERY portal, on top of subscribers (e.g. the Handbook). A portal can still opt out.' } },
    { name: 'optOuts', type: 'json',
      admin: { description: "string[] of tenant slugs that have switched this Work OFF for their portal. Beats availableGlobally and subscribers; the owner's own portal always carries it." } },
    { name: 'defaultDoc', type: 'text',
      admin: { description: 'Chapter slug opened first in the document viewer.' } },
    { name: 'links', type: 'json',
      admin: { description: '{ label, url }[] shown alongside the Work.' } },
    { name: 'cover', type: 'upload', relationTo: 'media' },
    { name: 'storageRef', type: 'json',
      admin: { description: "Storage-of-record pointer: { kind: 'file'|'messages', channel?, space? }." } },
    { name: 'checksum', type: 'text', index: true,
      admin: { description: 'Content address (sha256, url-independent) — the catalog-gossip handle.' } },
    { name: 'content', type: 'json',
      admin: { description: "Course body: { modules: [{ title, lessons: [{ title, video?, body? }] }] }. Edited in the Course Studio, not here. Only `type: course` uses it — documents and books keep their chapters as messages." } },
    { name: 'jsonVersion', type: 'text', defaultValue: 'work.v1',
      admin: { description: 'Work JSON interchange version.' } },
  ],
}
