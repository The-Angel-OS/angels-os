import type { CollectionBeforeValidateHook } from 'payload'

/**
 * Enforce unique [email + tenant] constraint.
 * Payload doesn't support compound unique indexes natively,
 * so we check manually before create/update.
 */
export const enforceUniqueEmailPerTenant: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req: { payload },
}) => {
  if (!data?.email) return data

  const email = (data.email as string).trim().toLowerCase()
  const tenantId = data?.tenant ?? originalDoc?.tenant

  if (!tenantId) return data

  // Resolve tenant ID (may be object or number)
  const resolvedTenantId = typeof tenantId === 'object' && tenantId !== null ? tenantId.id : tenantId

  const existing = await payload.find({
    collection: 'contacts',
    where: {
      and: [
        { email: { equals: email } },
        { tenant: { equals: resolvedTenantId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    const existingId = existing.docs[0]?.id
    const currentId = originalDoc?.id

    // On create, any match is a duplicate
    if (operation === 'create') {
      throw new Error(`A contact with email "${email}" already exists for this tenant.`)
    }

    // On update, only a match with a different ID is a duplicate
    if (operation === 'update' && existingId && String(existingId) !== String(currentId)) {
      throw new Error(`A contact with email "${email}" already exists for this tenant.`)
    }
  }

  // Normalize email to lowercase
  if (data) {
    data.email = email
  }

  return data
}
