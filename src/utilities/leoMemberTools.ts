/**
 * LEO for members — the four things a person actually asks a community's
 * assistant, as opposed to the ~160 tools that run the business.
 *
 *   whats_on            what is happening here, and what did I miss
 *   register_for_event  sign me up
 *   my_threads          did anyone answer me
 *   ask_the_room        you do not know? then hand it to the humans
 *
 * The last one matters most: an assistant that cannot say "I don't know, but
 * I've asked in #general" fills the gap with something invented instead.
 *
 * Standing is declared in leoToolStanding.ts and enforced at executeToolCall —
 * these handlers assume they may run, and scope to ctx.userId for WHOSE records
 * they return.
 */
import type { Payload } from 'payload'
import type Anthropic from '@anthropic-ai/sdk'

interface Ctx {
  payload: Payload
  tenantId?: number
  spaceId?: number
  userId?: number
  channelSlug?: string
}

export const MEMBER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'whats_on',
    description:
      "What is happening on this site: upcoming events plus what has been posted recently. Use for \"what's on\", \"anything happening this week\", \"what did I miss\", or when welcoming someone new. Prefer this over calling query_events and query_posts separately — it is one answer, already ordered.",
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'How many days ahead to look for events. Default 30.' },
        includeRecent: {
          type: 'boolean',
          description: 'Also list what was posted in the last two weeks. Default true.',
        },
      },
    },
  },
  {
    name: 'register_for_event',
    description:
      'Sign the current user up for an event. Idempotent — calling it twice reports the existing registration rather than duplicating it. If the event is full the person is waitlisted and told so. Confirm which event they mean first if there is any ambiguity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        event: { type: 'string', description: 'The event slug or title (a close title match is fine).' },
        attendanceMode: {
          type: 'string',
          enum: ['in-person', 'virtual'],
          description: 'How they plan to attend. Default in-person.',
        },
      },
      required: ['event'],
    },
  },
  {
    name: 'my_threads',
    description:
      'The current user\'s own comments, and whether anyone has replied since. Use for "did anyone answer me", "what did I comment on", "any replies?".',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'How many of their most recent comments. Default 10.' },
      },
    },
  },
  {
    name: 'ask_the_room',
    description:
      'Post the question into a channel so the PEOPLE here can answer it. Use when you genuinely do not know and no tool will tell you — this is the honest alternative to guessing. OUTWARD ACTION, so it is GATED: the first call (without confirm) returns a preview and posts nothing. Relay the preview, get an explicit go-ahead, then call again with confirm=true.',
    input_schema: {
      type: 'object' as const,
      properties: {
        question: { type: 'string', description: 'The question, in the user\'s own words where possible.' },
        channel: {
          type: 'string',
          description: 'Channel slug to post in. Defaults to the channel this conversation is in, else the space default.',
        },
        confirm: {
          type: 'boolean',
          description: 'Only true after the user has just approved posting this exact text.',
        },
      },
      required: ['question'],
    },
  },
]

export const MEMBER_TOOL_NAMES = MEMBER_TOOLS.map((t) => t.name)

const fmtDate = (d: unknown): string => {
  const dt = new Date(String(d))
  return Number.isNaN(dt.getTime())
    ? 'date TBC'
    : dt.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
}

/** whats_on — one digest, not two queries the model has to stitch together. */
export async function handleWhatsOn(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: Ctx,
): Promise<string> {
  const { tenantId } = ctx
  if (!tenantId) return 'Error: No portal context available.'
  const days = Math.min(Math.max(Number(input.days) || 30, 1), 365)
  const includeRecent = input.includeRecent !== false

  const now = new Date()
  const until = new Date(now.getTime() + days * 86_400_000)
  const lines: string[] = []

  const events = await payload.find({
    collection: 'events',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { status: { in: ['upcoming', 'live'] } },
        { startDateTime: { less_than_equal: until.toISOString() } },
      ],
    },
    sort: 'startDateTime',
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })

  const eventDocs = events.docs as unknown as Array<Record<string, unknown>>
  if (eventDocs.length) {
    lines.push(`Coming up (next ${days} days):`)
    for (const e of eventDocs) {
      lines.push(`- ${e.title} — ${fmtDate(e.startDateTime)} (/events/${e.slug})`)
    }
  } else {
    lines.push(`Nothing on the calendar in the next ${days} days.`)
  }

  if (includeRecent) {
    const since = new Date(now.getTime() - 14 * 86_400_000).toISOString()
    const posts = await payload.find({
      collection: 'posts',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { _status: { equals: 'published' } },
          { publishedAt: { greater_than_equal: since } },
        ],
      },
      sort: '-publishedAt',
      limit: 5,
      depth: 0,
      overrideAccess: true,
    })
    const postDocs = posts.docs as unknown as Array<Record<string, unknown>>
    if (postDocs.length) {
      lines.push('', 'Posted recently:')
      for (const p of postDocs) lines.push(`- ${p.title} (/posts/${p.slug})`)
    }
  }

  return lines.join('\n')
}

/** register_for_event — idempotent, and honest about capacity. */
export async function handleRegisterForEvent(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: Ctx,
): Promise<string> {
  const { tenantId, userId } = ctx
  if (!tenantId) return 'Error: No portal context available.'
  if (!userId) return 'Error: they need to be signed in before I can sign them up. Point them at Login.'

  const q = String(input.event || '').trim()
  if (!q) return 'Error: which event? Pass a slug or title.'

  const found = await payload.find({
    collection: 'events',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { or: [{ slug: { equals: q } }, { title: { like: q } }] },
      ],
    },
    sort: 'startDateTime',
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  const docs = found.docs as unknown as Array<Record<string, unknown>>
  if (!docs.length) return `No event here matches "${q}". Use whats_on to see what is scheduled.`
  if (docs.length > 1) {
    return `That matches more than one event: ${docs.map((d) => `"${d.title}"`).join(', ')}. Ask which they mean.`
  }
  const event = docs[0]!
  if (event.status === 'cancelled' || event.status === 'completed') {
    return `"${event.title}" is ${event.status}, so there is nothing to register for. Offer whats_on instead.`
  }

  const existing = await payload.find({
    collection: 'event-registrations',
    where: { and: [{ event: { equals: event.id } }, { attendee: { equals: userId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const already = (existing.docs as unknown as Array<Record<string, unknown>>)[0]
  if (already && already.status !== 'cancelled') {
    return `Already registered for "${event.title}" (${already.status}), ${fmtDate(event.startDateTime)}. Nothing more to do.`
  }

  // Capacity is a COUNT of live registrations, not a stored tally — a stored one
  // drifts the first time a registration is cancelled anywhere but here.
  let status = 'registered'
  const capacity = Number(event.capacity) || 0
  if (capacity > 0) {
    const taken = await payload.count({
      collection: 'event-registrations',
      where: {
        and: [{ event: { equals: event.id } }, { status: { in: ['registered', 'checked-in'] } }],
      },
      overrideAccess: true,
    })
    if (taken.totalDocs >= capacity) status = 'waitlisted'
  }

  const user = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  })
  const u = user as unknown as { name?: string; email?: string }

  try {
    if (already) {
      await payload.update({
        collection: 'event-registrations',
        id: already.id as number,
        data: { status } as never,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'event-registrations',
        data: {
          event: event.id,
          attendee: userId,
          name: u.name || u.email || 'Member',
          email: u.email,
          status,
          registrationType: 'pre-event',
          attendanceMode: (input.attendanceMode as string) || 'in-person',
          tenant: tenantId,
        } as never,
        overrideAccess: true,
      })
    }
  } catch (err) {
    return `Could not complete the registration: ${err instanceof Error ? err.message : 'unknown error'}`
  }

  return status === 'waitlisted'
    ? `"${event.title}" is full, so they are on the WAITLIST — say so plainly, and that they will be told if a place opens. ${fmtDate(event.startDateTime)}.`
    : `Registered for "${event.title}", ${fmtDate(event.startDateTime)}. Confirm it warmly and briefly.`
}

/** my_threads — their own comments, and whether the thread moved since. */
export async function handleMyThreads(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: Ctx,
): Promise<string> {
  const { tenantId, userId } = ctx
  if (!userId) return 'Error: they need to be signed in for me to find their comments.'
  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 25)

  const user = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  })
  const email = (user as unknown as { email?: string }).email
  // Comments carry an author NAME and email, not a user relationship — email is
  // the only identity they hold, so it is what "mine" has to mean here.
  if (!email) return 'Error: no email on this account, so I cannot match their comments.'

  const mine = await payload.find({
    collection: 'comments',
    where: {
      and: [{ email: { equals: email } }, ...(tenantId ? [{ tenant: { equals: tenantId } }] : [])],
    },
    sort: '-createdAt',
    limit,
    depth: 1,
    overrideAccess: true,
  })
  const docs = mine.docs as unknown as Array<Record<string, unknown>>
  if (!docs.length) return 'They have not commented anywhere here yet.'

  const lines: string[] = []
  for (const c of docs) {
    const parent = c.parent as
      | { value?: { id?: number; title?: string; slug?: string } }
      | undefined
    const on = parent?.value?.title ? `"${parent.value.title}"` : 'a page'
    const parentId = parent?.value?.id
    let since = ' — nothing since'
    if (parentId) {
      const replies = await payload.count({
        collection: 'comments',
        where: {
          and: [
            { parent: { equals: parentId } },
            { createdAt: { greater_than: String(c.createdAt) } },
            { isApproved: { equals: true } },
          ],
        },
        overrideAccess: true,
      })
      if (replies.totalDocs) {
        since = ` — ${replies.totalDocs} ${replies.totalDocs === 1 ? 'reply' : 'replies'} since`
      }
    }
    lines.push(`- On ${on}: "${String(c.content ?? '').slice(0, 80)}"${since}`)
  }
  return `Their recent comments:\n${lines.join('\n')}`
}

/** ask_the_room — hand the question to the humans, gated like message_contact. */
export async function handleAskTheRoom(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: Ctx,
): Promise<string> {
  const { tenantId, userId } = ctx
  if (!tenantId) return 'Error: No portal context available.'
  if (!userId) return 'Error: they need to be signed in to post. Point them at Login.'

  const question = String(input.question || '').trim()
  if (!question) return 'Error: nothing to ask.'

  let spaceId = ctx.spaceId
  if (!spaceId) {
    const spaces = await payload.find({
      collection: 'spaces',
      where: { tenant: { equals: tenantId } },
      sort: 'createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    spaceId = (spaces.docs as unknown as Array<{ id: number }>)[0]?.id
  }
  if (!spaceId) return 'Error: this portal has no space to post into yet.'

  const channel = String(input.channel || ctx.channelSlug || 'general').trim()

  if (input.confirm !== true) {
    return [
      'NOT POSTED YET — this is a preview. Show it to them and ask whether to post it.',
      `Channel: #${channel}`,
      `Message: ${question}`,
      'If they say yes, call ask_the_room again with confirm=true.',
    ].join('\n')
  }

  try {
    // Posted AS the user, never as LEO: the room should see who is asking, and a
    // reply should reach the person rather than the assistant.
    await payload.create({
      collection: 'messages',
      data: {
        content: question,
        space: spaceId,
        channel,
        messageType: 'user',
        author: userId,
        tenant: tenantId,
        visibility: 'tenant',
      } as never,
      overrideAccess: true,
    })
  } catch (err) {
    return `Could not post that: ${err instanceof Error ? err.message : 'unknown error'}`
  }
  return `Posted in #${channel}. Tell them where it went and that the people there will see it.`
}
