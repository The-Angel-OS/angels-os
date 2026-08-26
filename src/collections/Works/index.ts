/**
 * Works — the Library catalog: one record per Work.
 *
 * The fields a person EDITS are real Payload fields (arrays and groups), so the
 * admin gives you a proper editor instead of six raw-JSON textareas. The fields
 * that are PLUMBING — `storageRef`, `checksum`, `subscribers`, `optOuts`,
 * `content` — stay JSON and sit in a collapsed section: availability already has
 * a far better surface at /dashboard/works (a checkbox per portal), and nobody
 * should be hand-editing a checksum.
 *
 * Federation-portable by design: `owner` and the subscriber lists are tenant
 * SLUGS (stable across nodes), never relationship ids (which differ per node).
 *
 * Chapters live in `work-chapters`, one row each, with their own editor.
 *
 * @see docs/planning/WORKS_AS_JSON.md
 */
import type { CollectionConfig } from 'payload'

export const Works: CollectionConfig = {
  slug: 'works',
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'type', 'published', 'owner', 'updatedAt'],
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
    { name: 'title', type: 'text', required: true },
    { name: 'subtitle', type: 'text' },
    { name: 'description', type: 'textarea' },

    { name: 'tags', type: 'array', labels: { singular: 'Tag', plural: 'Tags' },
      admin: { description: 'Library facets — "book", "scripture", "primer".' },
      fields: [{ name: 'tag', type: 'text', required: true }] },

    { name: 'links', type: 'array', labels: { singular: 'Link', plural: 'Links' },
      admin: { description: 'Shown alongside the Work — the original site, a companion portal.' },
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ] },

    { name: 'canonical', type: 'group',
      admin: { description: 'Publish-once-canonical: where this Work is the original, and who gets the byline.' },
      fields: [
        { name: 'origin', type: 'text', admin: { description: 'Publisher root, e.g. https://wheredideveryonego.spacesangels.com. A subscriber portal credits THIS origin.' } },
        { name: 'endeavor', type: 'text', admin: { description: 'Publishing endeavor slug.' } },
        { name: 'creditedTo', type: 'text', admin: { description: "Author of record — the byline's email." } },
      ] },

    { name: 'defaultDoc', type: 'text',
      admin: { description: 'Chapter slug opened first in the document viewer.' } },
    { name: 'cover', type: 'upload', relationTo: 'media' },

    // ── Sidebar: what this Work IS and who can see it ────────────────────────
    { name: 'slug', type: 'text', required: true, index: true, unique: true,
      admin: { position: 'sidebar', description: 'Stable Work id — the /learn/<slug> address. Changing it breaks every link already sent.' } },
    { name: 'type', type: 'select', defaultValue: 'document', index: true,
      admin: { position: 'sidebar' },
      options: [
        { label: 'Document (case file / manifesto)', value: 'document' },
        { label: 'Book (illustrated, paged)', value: 'book' },
        { label: 'Course (modules and lessons)', value: 'course' },
      ] },
    { name: 'published', type: 'checkbox', defaultValue: false, index: true,
      admin: { position: 'sidebar', description: 'Listed on public Library indexes. Unpublished stays an editable working copy, reachable by direct link.' } },
    { name: 'owner', type: 'text', index: true,
      admin: { position: 'sidebar', description: 'Owning endeavor — a tenant SLUG (federation-stable, not an id).' } },
    { name: 'availableGlobally', type: 'checkbox', defaultValue: false,
      admin: { position: 'sidebar', description: 'Offered to EVERY portal on top of subscribers (e.g. the Handbook). A portal can still opt out.' } },
    { name: 'status', type: 'text', admin: { position: 'sidebar', description: 'Badge text on the Library card.' } },
    { name: 'statusColor', type: 'text', admin: { position: 'sidebar' } },

    // ── Plumbing. Collapsed, because editing any of it by hand is a mistake ──
    { type: 'collapsible', label: 'Storage & federation (advanced)',
      admin: { initCollapsed: true, description: 'Written by the importer, the sync, and /dashboard/works. Hand-edit at your peril.' },
      fields: [
        { name: 'subscribers', type: 'json',
          admin: { description: 'string[] of subscriber tenant slugs. Set this from /dashboard/works — one checkbox per portal — not here.' } },
        { name: 'optOuts', type: 'json',
          admin: { description: "string[] of tenant slugs that switched this Work OFF. Beats availableGlobally and subscribers; the owner's own portal always carries it." } },
        { name: 'storageRef', type: 'json',
          admin: { description: "Storage-of-record pointer: { kind: 'file'|'messages', channel?, space?, languages?, baseLanguage? }." } },
        { name: 'content', type: 'json',
          admin: { description: 'Course body: { modules: [{ title, lessons: [{ title, video?, body? }] }] }. Edited in the Course Studio.' } },
        { name: 'checksum', type: 'text', index: true,
          admin: { description: 'Content address (sha256, url-independent) — the catalog-gossip handle.' } },
        { name: 'jsonVersion', type: 'text', defaultValue: 'work.v1',
          admin: { description: 'Work JSON interchange version.' } },
      ] },
  ],
}
