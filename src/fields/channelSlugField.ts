import type { Field } from 'payload'

/**
 * Stable, system-managed slug for Channels.
 *
 * A channel's slug is NOT a title-derived URL slug — it's a precise routing key
 * that must round-trip verbatim. Page-comment channels use `page:<path>` and the
 * Spaces viewer loads their messages via `where[channel][equals]=<slug>`, so the
 * slug has to equal `message.channel` EXACTLY.
 *
 * Payload's auto `slugField()` breaks this: `slugify()` strips `:` and `/` and
 * lowercases on create (`page:/about` → `pageabout`) AND regenerates the slug
 * from the `name` on every update. That silently severs the channel→messages
 * mapping (the channel shows in the list but loads zero messages) and makes
 * find-or-create non-idempotent (every backfill creates a fresh duplicate).
 *
 * A plain, explicitly-set text field avoids both failure modes. All channel
 * creation in this codebase already supplies an intentional slug
 * (`general`, `leo`, `dm-…`, `page:/…`), so nothing relies on auto-generation.
 */
export const channelSlugField: Field = {
  name: 'slug',
  type: 'text',
  required: true,
  index: true,
  // Multi-tenant: 'general' exists once per tenant; space/tenant scope disambiguates.
  unique: false,
  admin: {
    description:
      'Stable channel key set explicitly by the system (e.g. "general", "dm-…", "page:/about"). For page-comment channels this MUST equal message.channel — do not slugify.',
  },
}
