import type { CollectionBeforeValidateHook } from 'payload'

/**
 * Prevents duplicate category slugs within the same tenant.
 *
 * Categories use simpleSlugField (unique: false) because multi-tenant
 * allows the same slug across tenants. This hook enforces uniqueness
 * WITHIN a tenant — no two categories in the same tenant can share a slug.
 *
 * Also prevents duplicate titles within a tenant for cleaner admin UX
 * (the dropdown in product edit shouldn't show two "Technology" entries).
 */
export const preventDuplicateSlug: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  if (!data) return data
  const { payload } = req

  // Resolve tenant from data or originalDoc (multiTenantPlugin injects it)
  const tenantId =
    (data as any).tenant ??
    (originalDoc as any)?.tenant ??
    null

  if (!tenantId) return data

  const slug = data.slug || (originalDoc as any)?.slug
  const title = data.title || (originalDoc as any)?.title
  const currentId = (originalDoc as any)?.id

  // Check for existing category with same slug in same tenant
  if (slug) {
    const existing = await payload.find({
      collection: 'categories',
      where: {
        and: [
          { slug: { equals: slug } },
          { tenant: { equals: tenantId } },
          ...(operation === 'update' && currentId
            ? [{ id: { not_equals: currentId } }]
            : []),
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      throw new Error(
        `A category with slug "${slug}" already exists in this tenant. Choose a different title.`,
      )
    }
  }

  // Also check title uniqueness within tenant
  if (title) {
    const existingByTitle = await payload.find({
      collection: 'categories',
      where: {
        and: [
          { title: { equals: title } },
          { tenant: { equals: tenantId } },
          ...(operation === 'update' && currentId
            ? [{ id: { not_equals: currentId } }]
            : []),
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existingByTitle.docs.length > 0) {
      throw new Error(
        `A category with title "${title}" already exists in this tenant. Choose a different title.`,
      )
    }
  }

  return data
}
