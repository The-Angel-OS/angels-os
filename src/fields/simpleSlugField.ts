import { slugField } from 'payload'

/**
 * Slug field without custom SlugField component.
 * Avoids "useServerFunctions must be used within a ServerFunctionsProvider" error
 * when editing in Payload admin (e.g. Products, Categories).
 *
 * IMPORTANT: Sets unique: false because Angel OS is multi-tenant.
 * Two different tenants can have a post with slug "welcome" or a channel
 * with slug "general". URL routing disambiguates by tenant/domain.
 * Payload's slugField() hardcodes unique: true which breaks multi-tenant.
 */
export const simpleSlugField = slugField({
  overrides: (field) => {
    const slugFieldConfig = field.fields?.find((f) => 'name' in f && f.name === 'slug') as
      | { admin?: { components?: unknown }; unique?: boolean }
      | undefined
    if (slugFieldConfig?.admin?.components) {
      delete (slugFieldConfig.admin as { components?: unknown }).components
    }
    // Multi-tenant: allow duplicate slugs across tenants
    if (slugFieldConfig) {
      slugFieldConfig.unique = false
    }
    return field
  },
})
