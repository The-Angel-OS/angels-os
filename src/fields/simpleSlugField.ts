import { slugField } from 'payload'

/**
 * Slug field without custom SlugField component.
 * Avoids "useServerFunctions must be used within a ServerFunctionsProvider" error
 * when editing in Payload admin (e.g. Products, Categories).
 */
export const simpleSlugField = slugField({
  overrides: (field) => {
    const slugFieldConfig = field.fields?.find((f) => 'name' in f && f.name === 'slug') as
      | { admin?: { components?: unknown } }
      | undefined
    if (slugFieldConfig?.admin?.components) {
      delete (slugFieldConfig.admin as { components?: unknown }).components
    }
    return field
  },
})
