/**
 * Backfill Space Memberships
 *
 * For existing users who joined before the auto-join feature,
 * this script ensures they have memberships in their tenant's main space.
 *
 * Usage:
 *   npx tsx scripts/backfill-space-memberships.ts
 *
 * What it does:
 * 1. Finds all users with active tenant-memberships
 * 2. For each tenant, finds the oldest (main) space
 * 3. If the user isn't already a member of that space, creates a membership
 *
 * Safe to run multiple times (idempotent).
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function backfillSpaceMemberships() {
  console.log('🔧 Starting space membership backfill...\n')

  const payload = await getPayload({ config })

  // Get all active tenant memberships
  const tenantMemberships = await payload.find({
    collection: 'tenant-memberships',
    where: { status: { equals: 'active' } },
    depth: 0,
    limit: 1000,
    overrideAccess: true,
  })

  console.log(`Found ${tenantMemberships.totalDocs} active tenant memberships\n`)

  // Group by tenant
  const tenantMap = new Map<number, number[]>() // tenantId -> userIds
  for (const tm of tenantMemberships.docs) {
    const tenantId = typeof tm.tenant === 'number' ? tm.tenant : (tm.tenant as any)?.id
    const userId = typeof tm.user === 'number' ? tm.user : (tm.user as any)?.id
    if (!tenantId || !userId) continue

    if (!tenantMap.has(tenantId)) tenantMap.set(tenantId, [])
    tenantMap.get(tenantId)!.push(userId)
  }

  let created = 0
  let skipped = 0
  let errors = 0

  for (const [tenantId, userIds] of tenantMap) {
    // Find the main space for this tenant (oldest one)
    const spaces = await payload.find({
      collection: 'spaces',
      where: { tenant: { equals: tenantId } },
      sort: 'createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (spaces.totalDocs === 0) {
      console.log(`  ⚠ Tenant ${tenantId}: No spaces found, skipping ${userIds.length} users`)
      skipped += userIds.length
      continue
    }

    const mainSpace = spaces.docs[0]
    console.log(`\n📍 Tenant ${tenantId} → Main Space: "${mainSpace.name}" (id: ${mainSpace.id})`)

    for (const userId of userIds) {
      try {
        // Check if membership already exists
        const existing = await payload.find({
          collection: 'space-memberships',
          where: {
            user: { equals: userId },
            space: { equals: mainSpace.id },
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (existing.totalDocs > 0) {
          const status = (existing.docs[0] as any).status
          console.log(`  ✓ User ${userId}: already a member (status: ${status})`)
          skipped++
          continue
        }

        // Look up user email for logging
        const user = await payload.findByID({
          collection: 'users',
          id: userId,
          depth: 0,
          overrideAccess: true,
        })

        // Skip system users
        if (user.isSystemUser) {
          console.log(`  ⏭ User ${userId} (${user.email}): system user, skipping`)
          skipped++
          continue
        }

        // Create the space membership
        await payload.create({
          collection: 'space-memberships',
          data: {
            user: userId,
            space: mainSpace.id as number,
            role: 'member',
            status: 'active',
            joinedAt: new Date().toISOString(),
            tenant: tenantId,
          },
          overrideAccess: true,
        })

        console.log(`  ✅ User ${userId} (${user.email}): joined "${mainSpace.name}"`)
        created++
      } catch (err) {
        console.error(`  ❌ User ${userId}: failed - ${err}`)
        errors++
      }
    }
  }

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`✅ Created: ${created} new space memberships`)
  console.log(`⏭ Skipped: ${skipped} (already members or system users)`)
  console.log(`❌ Errors:  ${errors}`)
  console.log(`${'═'.repeat(50)}\n`)

  process.exit(0)
}

backfillSpaceMemberships().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
