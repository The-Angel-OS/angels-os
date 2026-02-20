/**
 * One-time data backfill: set tenant_id on channels, messages, and space_memberships
 * based on their parent space's tenant_id.
 *
 * Uses Payload's local API to read spaces and update related records.
 *
 * Run: npx cross-env NODE_OPTIONS=--no-deprecation PAYLOAD_MIGRATING=true npx tsx scripts/backfill-tenant-ids.ts
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function main() {
  process.env.PAYLOAD_MIGRATING = 'true' // Skip dev schema push
  const payload = await getPayload({ config })

  // Get all spaces with their tenant
  const spaces = await payload.find({
    collection: 'spaces',
    limit: 1000,
    overrideAccess: true,
  })

  console.log(`Found ${spaces.docs.length} spaces`)

  for (const space of spaces.docs) {
    const tenantId = typeof space.tenant === 'object' ? space.tenant?.id : space.tenant
    if (!tenantId) {
      console.log(`  Space ${space.id} has no tenant, skipping`)
      continue
    }

    console.log(`  Space ${space.id} -> tenant ${tenantId}`)

    // Update channels for this space
    const channels = await payload.find({
      collection: 'channels',
      where: {
        space: { equals: space.id },
      },
      limit: 1000,
      overrideAccess: true,
    })

    for (const channel of channels.docs) {
      const channelTenant = typeof (channel as any).tenant === 'object'
        ? (channel as any).tenant?.id
        : (channel as any).tenant
      if (!channelTenant) {
        console.log(`    Updating channel "${channel.name}" (${channel.id}) -> tenant ${tenantId}`)
        await payload.update({
          collection: 'channels',
          id: channel.id,
          data: { tenant: tenantId } as any,
          overrideAccess: true,
        })
      }
    }

    // Update messages for channels in this space
    for (const channel of channels.docs) {
      const messages = await payload.find({
        collection: 'messages',
        where: {
          channel: { equals: channel.id },
        },
        limit: 1000,
        overrideAccess: true,
      })

      for (const message of messages.docs) {
        const msgTenant = typeof (message as any).tenant === 'object'
          ? (message as any).tenant?.id
          : (message as any).tenant
        if (!msgTenant) {
          await payload.update({
            collection: 'messages',
            id: message.id,
            data: { tenant: tenantId } as any,
            overrideAccess: true,
          })
        }
      }
      if (messages.docs.length > 0) {
        const updated = messages.docs.filter((m) => {
          const t = typeof (m as any).tenant === 'object' ? (m as any).tenant?.id : (m as any).tenant
          return !t
        }).length
        if (updated > 0) {
          console.log(`    Updated ${updated} messages in channel "${channel.name}"`)
        }
      }
    }

    // Update space memberships
    const memberships = await payload.find({
      collection: 'space-memberships',
      where: {
        space: { equals: space.id },
      },
      limit: 1000,
      overrideAccess: true,
    })

    for (const membership of memberships.docs) {
      const memTenant = typeof (membership as any).tenant === 'object'
        ? (membership as any).tenant?.id
        : (membership as any).tenant
      if (!memTenant) {
        await payload.update({
          collection: 'space-memberships',
          id: membership.id,
          data: { tenant: tenantId } as any,
          overrideAccess: true,
        })
      }
    }
    if (memberships.docs.length > 0) {
      const updated = memberships.docs.filter((m) => {
        const t = typeof (m as any).tenant === 'object' ? (m as any).tenant?.id : (m as any).tenant
        return !t
      }).length
      if (updated > 0) {
        console.log(`    Updated ${updated} space memberships`)
      }
    }
  }

  console.log('\nAll tenant_ids backfilled!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
