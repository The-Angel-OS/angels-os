'use client'

/**
 * OperatorGuide — the practical half of /learn.
 *
 * /learn was entirely constitution and cosmology: true, but it answered none of
 * the questions an owner actually arrives with. This is the "how do I run my
 * portal" section, and it goes FIRST — philosophy is worth reading, but not
 * before someone can confirm a booking. Ken's 260820 call.
 *
 * Plain HTML + Tailwind, no animation, no LCARS. It is a manual; it should read
 * like one.
 *
 * ponytail: hardcoded copy, not CMS content — it documents THIS dashboard, so it
 * versions with the code. Move it into Payload the day non-engineers edit it.
 */

import React from 'react'
import Link from 'next/link'

type Task = {
  q: string
  steps: React.ReactNode[]
  href?: { label: string; url: string }
}

const BOOKINGS: Task[] = [
  {
    q: 'See what is booked',
    steps: [
      <>Open <b>Appointments</b>. Bookings are grouped Today / Tomorrow / This week / Later / Past, with a calendar toggle in the corner.</>,
      <>Each row shows the service, the customer, and the status: <b>pending</b>, <b>confirmed</b>, or <b>cancelled</b>.</>,
    ],
    href: { label: 'Appointments', url: '/dashboard/appointments' },
  },
  {
    q: 'Confirm or cancel a booking',
    steps: [
      <>Click the booking. It opens in the editor.</>,
      <>Change <b>Status</b> to <i>confirmed</i> or <i>cancelled</i> and Save. Cancelling reveals a reason field — fill it in; it is what the customer is told and what you will want in three months when someone asks.</>,
      <>Use <b>← Back to Appointments</b> at the top of the editor to return.</>,
    ],
  },
  {
    q: 'Reply to a customer about a booking',
    steps: [
      <>The booking carries the customer&rsquo;s email and phone. Reply from your own email or phone — there is no separate inbox to check, on purpose.</>,
      <>If they are a repeat customer, they are in <b>Contacts</b>, where their history lives.</>,
    ],
    href: { label: 'Contacts', url: '/dashboard/admin/contacts' },
  },
  {
    q: 'Stop taking bookings for a while',
    steps: [
      <>Open <b>Availability</b> and set the slot inactive, or change your weekly hours.</>,
      <>No availability means no open times on your booking page — customers see &ldquo;no open times&rdquo; rather than booking a slot you cannot work.</>,
    ],
    href: { label: 'Availability', url: '/dashboard/availability' },
  },
]

const CATALOG: Task[] = [
  {
    q: 'Add a product',
    steps: [
      <>Open <b>Products</b> → <b>New</b>. Title, price, and a picture are the three that matter; everything else has a working default.</>,
      <>Save as <b>draft</b> while you work on it. It goes live when you publish.</>,
    ],
    href: { label: 'Products', url: '/dashboard/products' },
  },
  {
    q: 'Add or price a service',
    steps: [
      <>Open <b>Services</b> → <b>New</b>. Pick <b>Hourly</b> if you bill time on the clock, <b>Flat</b> if the job is one price.</>,
      <>For hourly: <b>Hourly rate</b>, <b>Bill increment</b> (30 = round to the half-hour), and <b>Minimum</b> in minutes. A 5-hour minimum is <code>300</code>, not <code>5</code>.</>,
      <>A <b>Deposit</b> — flat dollars or a percent — is what reserves the slot.</>,
      <>The <b>Picture</b> is shown at the same size on your booking page as in the preview, so what you see when you choose it is what customers get.</>,
    ],
    href: { label: 'Services', url: '/dashboard/services' },
  },
  {
    q: 'Change what a page says',
    steps: [
      <>Open <b>Pages</b>, click the page, edit the blocks, Save.</>,
      <>Anything published is live immediately. Use <b>draft</b> if you are not sure yet.</>,
    ],
    href: { label: 'Pages', url: '/dashboard/pages' },
  },
]

const EDITOR: Task[] = [
  {
    q: 'What the editor is',
    steps: [
      <>The dashboard covers the everyday jobs. Behind it is the full editor — the same one that runs this platform — reachable from any &ldquo;edit&rdquo; link and from <b>Payload Admin</b> in the sidebar.</>,
      <>It shows one collection at a time: Bookings, Products, Pages, Posts, Media, Events. A list on the left, a document on the right.</>,
    ],
  },
  {
    q: 'Getting back',
    steps: [
      <>When you arrive from the dashboard, the editor shows <b>← Back to …</b> at the top, naming where you came from. It survives saving.</>,
      <>If you got there from the sidebar instead, there is nowhere to go back to — use the sidebar.</>,
    ],
  },
  {
    q: 'Drafts, versions, and undo',
    steps: [
      <>Most documents save as a draft first. <b>Publish</b> is a separate button, so you cannot break a live page by typing in it.</>,
      <>Every save keeps a version. If you make a mess, open <b>Versions</b> on the document and restore an earlier one. Nothing you do in the editor is unrecoverable.</>,
    ],
  },
  {
    q: 'You only see your own portal',
    steps: [
      <>The editor is scoped to the portal you are signed into. Other endeavors&rsquo; content is not hidden from you by politeness — it is not there.</>,
      <>Switch portals with the switcher at the top of the sidebar; your permissions travel with you.</>,
    ],
  },
]

function TaskCard({ task }: { task: Task }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-2 font-semibold">{task.q}</h3>
      <ol className="ml-4 list-decimal space-y-1.5 text-sm text-muted-foreground">
        {task.steps.map((s, i) => (
          <li key={i} className="leading-relaxed">
            {s}
          </li>
        ))}
      </ol>
      {task.href && (
        <Link
          href={task.href.url}
          className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
        >
          Open {task.href.label} →
        </Link>
      )}
    </div>
  )
}

function Group({ title, blurb, tasks }: { title: string; blurb: string; tasks: Task[] }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">{blurb}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {tasks.map((t) => (
          <TaskCard key={t.q} task={t} />
        ))}
      </div>
    </section>
  )
}

export function OperatorGuide() {
  return (
    <div className="mb-16">
      <h1 className="text-2xl font-bold sm:text-3xl">Running your portal</h1>
      <p className="mb-8 mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        The short version of everything you will actually do in a week. Nothing
        here is unrecoverable — every document keeps its versions, and publishing
        is always a separate step from saving.
      </p>

      <Group
        title="Bookings"
        blurb="Who is coming, when, and what to do when plans change."
        tasks={BOOKINGS}
      />
      <Group
        title="Products, services, and pages"
        blurb="What you sell and what your site says about it."
        tasks={CATALOG}
      />
      <Group
        title="The editor"
        blurb="The full editing surface behind the dashboard, and how not to get lost in it."
        tasks={EDITOR}
      />
    </div>
  )
}

export default OperatorGuide
