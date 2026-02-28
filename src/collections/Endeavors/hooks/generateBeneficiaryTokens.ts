/**
 * Endeavor beforeChange hook — auto-generates claimToken and designatedAt
 * for new beneficiary entries that don't have them yet.
 *
 * @see src/collections/Endeavors/index.ts — beneficiaries array
 */
import { randomUUID } from 'crypto'
import type { CollectionBeforeChangeHook } from 'payload'

export const generateBeneficiaryTokens: CollectionBeforeChangeHook = async ({
  data,
  operation,
}) => {
  if (!data?.beneficiaries || !Array.isArray(data.beneficiaries)) {
    return data
  }

  const now = new Date().toISOString()

  data.beneficiaries = data.beneficiaries.map((b: any) => {
    // Generate claimToken if missing (new entry)
    if (!b.claimToken) {
      b.claimToken = randomUUID()
    }
    // Set designatedAt if missing
    if (!b.designatedAt) {
      b.designatedAt = now
    }
    return b
  })

  return data
}
