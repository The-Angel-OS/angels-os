/**
 * Seed Make America Awesome Now tour events
 *
 * Usage: npx tsx scripts/seed-tour-events.ts
 *
 * Uses Payload Local API with overrideAccess to bypass auth.
 * Requires .env with DATABASE_URI and PAYLOAD_SECRET.
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function main() {
  const payload = await getPayload({ config })

  // Find the default tenant
  const tenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: 'default' } },
    limit: 1,
    overrideAccess: true,
  })
  const tenantId = tenants.docs[0]?.id
  if (!tenantId) {
    console.error('Default tenant not found!')
    process.exit(1)
  }
  console.log(`Using tenant: ${tenants.docs[0].name} (ID: ${tenantId})`)

  // Find any user to be the host (first user created is typically admin)
  const users = await payload.find({
    collection: 'users',
    limit: 1,
    sort: 'createdAt',
    overrideAccess: true,
  })
  const hostId = users.docs[0]?.id
  if (!hostId) {
    console.error('No users found!')
    process.exit(1)
  }
  console.log(`Host: ${(users.docs[0] as any).email} (ID: ${hostId})`)

  const tourEvents = [
    {
      title: 'Make America Awesome Now — Clearwater Kickoff',
      slug: 'maan-clearwater-kickoff',
      eventType: 'conference' as const,
      status: 'upcoming' as const,
      startDateTime: '2026-04-19T17:00:00.000Z',
      duration: 360,
      timezone: 'America/New_York',
      host: hostId,
      tenant: tenantId,
      location: {
        type: 'hybrid' as const,
        venueName: 'Clearwater Beach Amphitheater',
        address: 'Clearwater Beach, FL 33767',
        remoteLink: '/spaces',
        remotePlatform: 'angelos-live',
      },
      capacity: { maxAttendees: 5000, waitlistEnabled: true },
      registration: { isOpen: true, requiresApproval: false, allowLateRegistration: true },
      pricing: {
        isFree: false,
        amount: 4500,
        currency: 'usd',
        splitConfiguration: {
          providerShare: 60,
          platformShare: 20,
          operationsShare: 15,
          justiceShare: 5,
        },
      },
      announceToAIBus: true,
      tags: [
        { tag: 'maan-tour' },
        { tag: 'edm' },
        { tag: 'spiritual-awakening' },
        { tag: 'clearwater' },
        { tag: 'kickoff' },
      ],
    },
    {
      title: 'Make America Awesome Now — Nashville Night',
      slug: 'maan-nashville',
      eventType: 'conference' as const,
      status: 'upcoming' as const,
      startDateTime: '2026-05-10T18:00:00.000Z',
      duration: 300,
      timezone: 'America/Chicago',
      host: hostId,
      tenant: tenantId,
      location: {
        type: 'hybrid' as const,
        venueName: 'Ascend Amphitheater',
        address: '310 1st Ave S, Nashville, TN 37201',
        remoteLink: '/spaces',
        remotePlatform: 'angelos-live',
      },
      capacity: { maxAttendees: 6800, waitlistEnabled: true },
      registration: { isOpen: true, requiresApproval: false, allowLateRegistration: true },
      pricing: {
        isFree: false,
        amount: 5500,
        currency: 'usd',
        splitConfiguration: {
          providerShare: 60,
          platformShare: 20,
          operationsShare: 15,
          justiceShare: 5,
        },
      },
      announceToAIBus: true,
      tags: [
        { tag: 'maan-tour' },
        { tag: 'edm' },
        { tag: 'spiritual-awakening' },
        { tag: 'nashville' },
        { tag: 'country-meets-bass' },
      ],
    },
    {
      title: 'Make America Awesome Now — Austin Sunset Sessions',
      slug: 'maan-austin',
      eventType: 'conference' as const,
      status: 'upcoming' as const,
      startDateTime: '2026-05-24T19:00:00.000Z',
      duration: 300,
      timezone: 'America/Chicago',
      host: hostId,
      tenant: tenantId,
      location: {
        type: 'hybrid' as const,
        venueName: 'Moody Amphitheater at Waterloo Park',
        address: '1401 Trinity St, Austin, TX 78701',
        remoteLink: '/spaces',
        remotePlatform: 'angelos-live',
      },
      capacity: { maxAttendees: 5000, waitlistEnabled: true },
      registration: { isOpen: true, requiresApproval: false, allowLateRegistration: true },
      pricing: {
        isFree: false,
        amount: 5500,
        currency: 'usd',
        splitConfiguration: {
          providerShare: 60,
          platformShare: 20,
          operationsShare: 15,
          justiceShare: 5,
        },
      },
      announceToAIBus: true,
      tags: [
        { tag: 'maan-tour' },
        { tag: 'edm' },
        { tag: 'spiritual-awakening' },
        { tag: 'austin' },
        { tag: 'sunset-sessions' },
      ],
    },
    {
      title: 'Make America Awesome Now — Denver Elevation (Red Rocks)',
      slug: 'maan-denver-red-rocks',
      eventType: 'conference' as const,
      status: 'upcoming' as const,
      startDateTime: '2026-06-07T18:00:00.000Z',
      duration: 300,
      timezone: 'America/Denver',
      host: hostId,
      tenant: tenantId,
      location: {
        type: 'hybrid' as const,
        venueName: 'Red Rocks Amphitheatre',
        address: '18300 W Alameda Pkwy, Morrison, CO 80465',
        remoteLink: '/spaces',
        remotePlatform: 'angelos-live',
      },
      capacity: { maxAttendees: 9525, waitlistEnabled: true },
      registration: { isOpen: true, requiresApproval: false, allowLateRegistration: true },
      pricing: {
        isFree: false,
        amount: 7500,
        currency: 'usd',
        splitConfiguration: {
          providerShare: 60,
          platformShare: 20,
          operationsShare: 15,
          justiceShare: 5,
        },
      },
      announceToAIBus: true,
      tags: [
        { tag: 'maan-tour' },
        { tag: 'edm' },
        { tag: 'spiritual-awakening' },
        { tag: 'denver' },
        { tag: 'red-rocks' },
        { tag: 'elevation' },
      ],
    },
    {
      title: 'National Pray Together Day — July 4th Livestream',
      slug: 'maan-pray-together-july4',
      eventType: 'livestream' as const,
      status: 'upcoming' as const,
      startDateTime: '2026-07-04T16:00:00.000Z',
      duration: 180,
      timezone: 'America/New_York',
      host: hostId,
      tenant: tenantId,
      location: {
        type: 'virtual' as const,
        remoteLink: '/spaces',
        remotePlatform: 'angelos-live',
      },
      capacity: { maxAttendees: 0, waitlistEnabled: false },
      registration: { isOpen: true, requiresApproval: false, allowLateRegistration: true },
      pricing: {
        isFree: true,
        currency: 'usd',
        splitConfiguration: {
          providerShare: 60,
          platformShare: 20,
          operationsShare: 15,
          justiceShare: 5,
        },
      },
      announceToAIBus: true,
      tags: [
        { tag: 'maan-tour' },
        { tag: 'pray-together' },
        { tag: 'national' },
        { tag: 'july4th' },
        { tag: 'free' },
        { tag: 'livestream' },
      ],
    },
    {
      title: 'Make America Awesome Now — BPM Festival Tie-In',
      slug: 'maan-bpm-festival',
      eventType: 'conference' as const,
      status: 'upcoming' as const,
      startDateTime: '2026-08-15T14:00:00.000Z',
      duration: 600,
      timezone: 'America/Chicago',
      host: hostId,
      tenant: tenantId,
      location: {
        type: 'hybrid' as const,
        venueName: 'BPM Festival Stage — Angel OS Pavilion',
        address: 'Costa Rica (exact venue TBA)',
        remoteLink: '/spaces',
        remotePlatform: 'angelos-live',
      },
      capacity: { maxAttendees: 10000, waitlistEnabled: true },
      registration: { isOpen: true, requiresApproval: false, allowLateRegistration: true },
      pricing: {
        isFree: false,
        amount: 9500,
        currency: 'usd',
        splitConfiguration: {
          providerShare: 60,
          platformShare: 20,
          operationsShare: 15,
          justiceShare: 5,
        },
      },
      announceToAIBus: true,
      tags: [
        { tag: 'maan-tour' },
        { tag: 'bpm-festival' },
        { tag: 'edm' },
        { tag: 'spiritual-awakening' },
        { tag: 'costa-rica' },
        { tag: 'international' },
      ],
    },
  ]

  for (const eventData of tourEvents) {
    try {
      // Check if event already exists
      const existing = await payload.find({
        collection: 'events',
        where: { slug: { equals: eventData.slug } },
        limit: 1,
        overrideAccess: true,
      })

      if (existing.docs.length > 0) {
        console.log(`⏭️  Skipping "${eventData.title}" — already exists (ID: ${existing.docs[0].id})`)
        continue
      }

      const doc = await payload.create({
        collection: 'events',
        data: eventData as any,
        overrideAccess: true,
      })
      console.log(`✅ Created: "${doc.title}" (ID: ${doc.id})`)
    } catch (err: any) {
      console.error(`❌ Failed: "${eventData.title}" — ${err.message || err}`)
    }
  }

  console.log('\nDone! Visit /events to see the tour lineup.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
