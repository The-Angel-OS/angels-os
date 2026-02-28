/**
 * Dev Dashboard Seed Script
 *
 * Usage: pnpm seed:dev
 *
 * Quick, additive seed that creates dashboard-specific test data:
 * - 1 tenant ("Dev Dashboard") with branding
 * - 5 users (admin, mod, member, guest, LEO agent)
 * - 3 spaces (Community, Team, AI Bus)
 * - 10 channels (various types)
 * - Space memberships for all users
 * - 3 projects (Angel OS MVP, Community Portal, Kitchen Remodel)
 * - 1 header (Main Header) with 4 nav items
 * - 1 footer (Main Footer) with 3 nav items
 * - Welcome messages in general channels
 *
 * Safe to run multiple times — uses findOrCreate pattern throughout.
 * Completes in <5 seconds (no media uploads).
 */
import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const startTime = Date.now()

  console.log('\n🛡️  Angel OS Dev Dashboard Seed')
  console.log('═'.repeat(50))
  console.log('Loading Payload configuration...\n')

  // Dynamic imports (ensure dotenv is loaded first)
  const { getPayload, createLocalReq } = await import('payload')
  const {
    findOrCreateTenant,
    findOrCreateUser,
    findOrCreateLeoUser,
    findOrCreateTenantMembership,
    findOrCreateSpaceMembership,
  } = await import('../endpoints/seed/seed-helpers.js')

  // Import config
  const configPath = path.resolve(__dirname, '../payload.config.ts')
  const configUrl = `file:///${configPath.replace(/\\/g, '/')}`
  const configModule = await import(configUrl)
  const config = configModule.default

  const payload = await getPayload({ config })
  const req = await createLocalReq({}, payload)

  // ─── Step 1: Tenant ───────────────────────────────────────────────
  console.log('📦 Step 1/7: Creating tenant...')
  const tenant = await findOrCreateTenant(payload, req, {
    name: 'Dev Dashboard',
    slug: 'dev-dashboard',
    domain: 'dev-dashboard.localhost',
    branding: {
      siteName: 'Dev Dashboard',
      primaryColor: '#6366F1',
      secondaryColor: '#EC4899',
      accentColor: '#F59E0B',
      backgroundColor: '#FFFFFF',
      foregroundColor: '#1A1A1A',
      borderColor: '#E5E7EB',
      tagline: 'Development & Testing Tenant',
      headingFont: 'inter',
      bodyFont: 'inter',
    },
  })
  const tenantId = tenant.id
  console.log(`   ✅ Tenant: ${tenant.name} (id: ${tenantId})`)

  // ─── Step 2: Users ────────────────────────────────────────────────
  console.log('👤 Step 2/7: Creating users...')
  const devPassword = 'devdev123'

  const admin = await findOrCreateUser(payload, req, {
    email: 'dev-admin@spacesangels.com',
    name: 'Dev Admin',
    password: devPassword,
    roles: ['admin'],
    tenantId,
  })
  console.log(`   ✅ Admin: ${admin.email}`)

  const mod = await findOrCreateUser(payload, req, {
    email: 'dev-mod@spacesangels.com',
    name: 'Dev Moderator',
    password: devPassword,
    roles: ['admin'], // admin role but will be moderator in spaces
    tenantId,
  })
  console.log(`   ✅ Moderator: ${mod.email}`)

  const member = await findOrCreateUser(payload, req, {
    email: 'dev-member@spacesangels.com',
    name: 'Dev Member',
    password: devPassword,
    roles: ['customer'],
    tenantId,
  })
  console.log(`   ✅ Member: ${member.email}`)

  const guest = await findOrCreateUser(payload, req, {
    email: 'dev-guest@spacesangels.com',
    name: 'Dev Guest',
    password: devPassword,
    roles: ['customer'],
    tenantId,
  })
  console.log(`   ✅ Guest: ${guest.email}`)

  const leo = await findOrCreateLeoUser(payload, req, {
    tenantId,
    tenantSlug: 'dev-dashboard',
    displayName: 'LEO (Dev)',
  })
  console.log(`   ✅ LEO Agent: ${leo.email}`)

  // ─── Step 3: Tenant Memberships ───────────────────────────────────
  console.log('🔗 Step 3/7: Creating tenant memberships...')
  await findOrCreateTenantMembership(payload, req, { userId: admin.id, tenantId, role: 'tenant_admin' })
  await findOrCreateTenantMembership(payload, req, { userId: mod.id, tenantId, role: 'tenant_admin' })
  await findOrCreateTenantMembership(payload, req, { userId: member.id, tenantId, role: 'tenant_member' })
  await findOrCreateTenantMembership(payload, req, { userId: guest.id, tenantId, role: 'tenant_member' })
  await findOrCreateTenantMembership(payload, req, { userId: leo.id, tenantId, role: 'tenant_member' })
  console.log('   ✅ 5 tenant memberships')

  // ─── Step 4: Spaces ───────────────────────────────────────────────
  console.log('🌐 Step 4/7: Creating spaces...')

  const findOrCreateSpace = async (data: {
    name: string
    slug: string
    description: string
    visibility: string
    isSystem?: boolean
  }) => {
    const existing = await payload.find({
      collection: 'spaces',
      where: {
        and: [
          { slug: { equals: data.slug } },
          { tenant: { equals: tenantId } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs?.[0]) {
      const s = existing.docs[0] as { id: number | string; name: string; slug: string }
      return s
    }
    const created = await payload.create({
      collection: 'spaces',
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        visibility: data.visibility,
        isSystem: data.isSystem || false,
        tenant: tenantId as number,
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      req,
      overrideAccess: true,
    })
    return { id: created.id, name: created.name, slug: created.slug }
  }

  const community = await findOrCreateSpace({
    name: 'Community',
    slug: 'community',
    description: 'Public community space for all members',
    visibility: 'public',
  })
  console.log(`   ✅ Space: ${community.name}`)

  const team = await findOrCreateSpace({
    name: 'Team',
    slug: 'team',
    description: 'Private team workspace for collaboration',
    visibility: 'invite_only',
  })
  console.log(`   ✅ Space: ${team.name}`)

  const aiBus = await findOrCreateSpace({
    name: 'AI Bus',
    slug: 'ai-bus',
    description: 'System space for AI agent communication',
    visibility: 'private',
    isSystem: true,
  })
  console.log(`   ✅ Space: ${aiBus.name} (system)`)

  // ─── Step 5: Channels ─────────────────────────────────────────────
  console.log('📺 Step 5/7: Creating channels...')
  let channelCount = 0

  const findOrCreateChannel = async (data: {
    name: string
    slug: string
    description: string
    spaceId: number | string
    type: string
    isDefault?: boolean
  }) => {
    const existing = await payload.find({
      collection: 'channels',
      where: {
        and: [
          { slug: { equals: data.slug } },
          { space: { equals: data.spaceId } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs?.[0]) {
      return existing.docs[0] as { id: number | string; name: string; slug: string }
    }
    const created = await payload.create({
      collection: 'channels',
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        space: data.spaceId,
        type: data.type,
        isDefault: data.isDefault || false,
        tenant: tenantId as number,
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      req,
      overrideAccess: true,
    })
    channelCount++
    return { id: created.id, name: created.name, slug: created.slug }
  }

  // Community channels
  const communityGeneral = await findOrCreateChannel({
    name: 'general', slug: 'general', description: 'General discussion',
    spaceId: community.id, type: 'general', isDefault: true,
  })
  await findOrCreateChannel({
    name: 'announcements', slug: 'announcements', description: 'Important updates',
    spaceId: community.id, type: 'announcements',
  })
  await findOrCreateChannel({
    name: 'support', slug: 'support', description: 'Get help from the community',
    spaceId: community.id, type: 'support',
  })
  await findOrCreateChannel({
    name: 'social', slug: 'social', description: 'Off-topic chat and fun',
    spaceId: community.id, type: 'social',
  })

  // Team channels
  const teamGeneral = await findOrCreateChannel({
    name: 'general', slug: 'general', description: 'Team discussions',
    spaceId: team.id, type: 'general', isDefault: true,
  })
  await findOrCreateChannel({
    name: 'projects', slug: 'projects', description: 'Project tracking and updates',
    spaceId: team.id, type: 'team',
  })
  await findOrCreateChannel({
    name: 'standup', slug: 'standup', description: 'Daily standup notes',
    spaceId: team.id, type: 'general',
  })

  // AI Bus channels
  await findOrCreateChannel({
    name: 'system-log', slug: 'system-log', description: 'System event log',
    spaceId: aiBus.id, type: 'general', isDefault: true,
  })
  await findOrCreateChannel({
    name: 'agent-chat', slug: 'agent-chat', description: 'Inter-agent communication',
    spaceId: aiBus.id, type: 'general',
  })
  await findOrCreateChannel({
    name: 'integrations', slug: 'integrations', description: 'External integration messages',
    spaceId: aiBus.id, type: 'general',
  })

  console.log(`   ✅ ${channelCount > 0 ? channelCount : 10} channels across 3 spaces`)

  // ─── Step 6: Space Memberships ────────────────────────────────────
  console.log('👥 Step 6/7: Creating space memberships...')
  const allUsers = [
    { user: admin, role: 'space_admin' },
    { user: mod, role: 'moderator' },
    { user: member, role: 'member' },
    { user: guest, role: 'guest' },
    { user: leo, role: 'member' },
  ]
  const allSpaces = [community, team, aiBus]

  for (const space of allSpaces) {
    for (const { user, role } of allUsers) {
      await findOrCreateSpaceMembership(payload, req, {
        userId: user.id,
        spaceId: space.id,
        role,
        tenantId,
      })
    }
  }
  console.log(`   ✅ ${allUsers.length * allSpaces.length} space memberships`)

  // ─── Step 7: Seed Projects ──────────────────────────────────────
  console.log('📐 Step 7/10: Seeding projects...')

  const findOrCreateProject = async (data: {
    title: string
    slug: string
    projectType: string
    projectStatus: string
    clientName: string
    clientDisplayName: string
    isPublic: boolean
    isFeatured?: boolean
    timeline?: { startDate?: string; completedAt?: string; estimatedDuration?: string }
    budget?: { budgetRange?: string }
    testimonial?: { quote?: string; rating?: number; isPublic?: boolean }
  }) => {
    const existing = await payload.find({
      collection: 'projects',
      where: { slug: { equals: data.slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs?.length) return existing.docs[0]
    const created = await payload.create({
      collection: 'projects',
      data: {
        title: data.title,
        slug: data.slug,
        projectType: data.projectType,
        projectStatus: data.projectStatus,
        client: {
          name: data.clientName,
          displayName: data.clientDisplayName,
        },
        isPublic: data.isPublic,
        isFeatured: data.isFeatured || false,
        timeline: data.timeline || {},
        budget: data.budget || {},
        testimonial: data.testimonial || {},
        tenant: tenantId as number,
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      req,
      overrideAccess: true,
    })
    return created
  }

  await findOrCreateProject({
    title: 'Angel OS MVP',
    slug: 'angel-os-mvp',
    projectType: 'other',
    projectStatus: 'in-progress',
    clientName: 'Internal',
    clientDisplayName: 'Angel OS Platform',
    isPublic: true,
    isFeatured: true,
    timeline: {
      startDate: '2024-09-01',
      estimatedDuration: '6 months',
    },
  })

  await findOrCreateProject({
    title: 'Community Portal Redesign',
    slug: 'community-portal-redesign',
    projectType: 'consultation',
    projectStatus: 'completed',
    clientName: 'Demo Client',
    clientDisplayName: 'Community Client - Tampa, FL',
    isPublic: true,
    timeline: {
      startDate: '2025-01-15',
      completedAt: '2025-03-20',
      estimatedDuration: '2 months',
    },
    budget: { budgetRange: '5k-15k' },
    testimonial: {
      quote: 'Transformed our community engagement. The Guardian Angel concept is brilliant.',
      rating: 5,
      isPublic: true,
    },
  })

  await findOrCreateProject({
    title: 'Kitchen Remodel - Showcase',
    slug: 'kitchen-remodel-showcase',
    projectType: 'kitchen',
    projectStatus: 'completed',
    clientName: 'Showcase Client',
    clientDisplayName: 'Residential Client - Largo, FL',
    isPublic: true,
    isFeatured: true,
    timeline: {
      startDate: '2025-06-01',
      completedAt: '2025-08-15',
      estimatedDuration: '10 weeks',
    },
    budget: { budgetRange: '15k-50k' },
    testimonial: {
      quote: 'Exceeded our expectations in every way. The project tracking was seamless.',
      rating: 5,
      isPublic: true,
    },
  })

  console.log('   ✅ 3 sample projects')

  // ─── Step 8: Header & Footer ─────────────────────────────────────
  console.log('🧭 Step 8/10: Seeding header & footer...')

  const findOrCreateHeaderFooter = async (
    collection: 'header' | 'footer',
    label: string,
    navItems: Array<{ link: { type: string; url: string; label: string; newTab?: boolean } }>,
  ) => {
    const existing = await payload.find({
      collection,
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs?.length) return existing.docs[0]
    return payload.create({
      collection,
      data: {
        label,
        navItems,
        tenant: tenantId as number,
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      req,
      overrideAccess: true,
    })
  }

  await findOrCreateHeaderFooter('header', 'Main Header', [
    { link: { type: 'custom', url: '/', label: 'Home' } },
    { link: { type: 'custom', url: '/posts', label: 'Blog' } },
    { link: { type: 'custom', url: '/projects', label: 'Portfolio' } },
    { link: { type: 'custom', url: '/contact', label: 'Contact' } },
  ])
  console.log('   ✅ Header with 4 nav items')

  await findOrCreateHeaderFooter('footer', 'Main Footer', [
    { link: { type: 'custom', url: '/privacy', label: 'Privacy Policy' } },
    { link: { type: 'custom', url: '/terms', label: 'Terms of Service' } },
    { link: { type: 'custom', url: '/contact', label: 'Contact Us' } },
  ])
  console.log('   ✅ Footer with 3 nav items')

  // ─── Step 9: Seed Messages ────────────────────────────────────────
  console.log('💬 Step 9/10: Seeding welcome messages...')

  const seedMessage = async (
    authorId: number | string,
    spaceId: number | string,
    channelSlug: string,
    text: string,
    messageType: string = 'system',
  ) => {
    // Check if messages already exist in this channel
    const existing = await payload.find({
      collection: 'messages',
      where: {
        and: [
          { channel: { equals: channelSlug } },
          { space: { equals: spaceId } },
          { tenant: { equals: tenantId } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs?.length) return // Already has messages

    await payload.create({
      collection: 'messages',
      data: {
        author: authorId as number,
        space: spaceId,
        channel: channelSlug,
        content: { type: 'text', text } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        messageType,
        tenant: tenantId as number,
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      req,
      overrideAccess: true,
    })
  }

  await seedMessage(
    leo.id, community.id, communityGeneral.slug,
    'Welcome to the Dev Dashboard community! 🦅 I\'m LEO, your Guardian Angel. Ask me anything about your endeavor.',
  )
  await seedMessage(
    admin.id, community.id, communityGeneral.slug,
    'This is a development environment for testing Angel OS dashboard features.',
    'text',
  )
  await seedMessage(
    leo.id, team.id, teamGeneral.slug,
    'Team workspace initialized. Use this space for collaboration and project tracking.',
  )
  console.log('   ✅ Welcome messages seeded')

  // ─── Step 10: Clean up duplicate DM channels ───────────────────────
  console.log('🧹 Step 9/9: Cleaning duplicate DM channels...')
  try {
    const allDmChannels = await payload.find({
      collection: 'channels',
      where: {
        and: [
          { type: { equals: 'dm' } },
          { tenant: { equals: tenantId } },
        ],
      },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })

    if (allDmChannels.docs.length > 0) {
      const slugMap = new Map<string, Array<{ id: number | string }>>()
      for (const ch of allDmChannels.docs) {
        const slug = (ch as any).slug as string
        if (!slugMap.has(slug)) slugMap.set(slug, [])
        slugMap.get(slug)!.push({ id: ch.id })
      }

      let deletedCount = 0
      for (const [slug, channels] of slugMap) {
        if (channels.length > 1) {
          // Keep the first (oldest), delete the rest
          for (let i = 1; i < channels.length; i++) {
            try {
              await payload.delete({
                collection: 'channels',
                id: channels[i].id as number,
                overrideAccess: true,
              })
              deletedCount++
            } catch {
              // Non-critical
            }
          }
        }
      }
      console.log(
        deletedCount > 0
          ? `   ✅ Removed ${deletedCount} duplicate DM channel(s)`
          : '   ✅ No duplicate DM channels found',
      )
    } else {
      console.log('   ✅ No DM channels to clean up')
    }
  } catch (err) {
    console.warn('   ⚠️ DM cleanup failed (non-critical):', err)
  }

  // ─── Summary ──────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n' + '═'.repeat(50))
  console.log('🛡️  Dev Dashboard Seed Complete!')
  console.log(`   Tenant:     ${tenant.name} (slug: ${tenant.slug})`)
  console.log(`   Users:      5 (admin, mod, member, guest, LEO)`)
  console.log(`   Spaces:     3 (Community, Team, AI Bus)`)
  console.log(`   Channels:   10 (general, announcements, support, social, projects, standup, system-log, agent-chat, integrations)`)
  console.log(`   Memberships: ${allUsers.length * allSpaces.length} space + 5 tenant`)
  console.log(`   Projects:   3 sample projects`)
  console.log(`   Header:     1 with 4 nav items`)
  console.log(`   Footer:     1 with 3 nav items`)
  console.log(`   Messages:   3 welcome messages`)
  console.log(`   Time:       ${elapsed}s`)
  console.log(`\n   Login: dev-admin@spacesangels.com / devdev123`)
  console.log('═'.repeat(50) + '\n')

  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌ Dev seed failed:', err)
  process.exit(1)
})
