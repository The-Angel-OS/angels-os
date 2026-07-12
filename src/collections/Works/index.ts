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
    update: ({ req: { user } }) => Boolean(user),
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
    { name: 'cover', type: 'upload', relationTo: 'media' },
    { name: 'storageRef', type: 'json',
      admin: { description: "Storage-of-record pointer: { kind: 'file'|'messages', channel?, space? }." } },
    { name: 'checksum', type: 'text', index: true,
      admin: { description: 'Content address (sha256, url-independent) — the catalog-gossip handle.' } },
    { name: 'jsonVersion', type: 'text', defaultValue: 'work.v1',
      admin: { description: 'Work JSON interchange version.' } },
  ],
}
