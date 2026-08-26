/**
 * /u/<handle> — a person's profile: who they are, and what they have earned.
 *
 * The route HONOURS `profileVisibility` server-side, which defaults to
 * 'members'. `private` is a 404 to everyone but the owner, `members` needs a
 * signed-in reader, `public` is open. Nobody became world-visible because this
 * shipped — going public is a switch they flip themselves.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Image from 'next/image'
import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const dynamic = 'force-dynamic'

interface ProfileUser {
  id: number | string
  name?: string | null
  handle?: string | null
  bio?: string | null
  avatarUrl?: string | null
  profileVisibility?: string | null
  badges?: Array<{ work?: string; name?: string | null; image?: string | null; awardedAt?: string | null; score?: number | null }> | null
}

/** The profile, or null when this reader may not see it. */
async function loadProfile(handle: string): Promise<ProfileUser | null> {
  const payload = await getPayload({ config: configPromise })
  const res = await payload.find({
    collection: 'users',
    where: { handle: { equals: handle } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const person = res.docs?.[0] as ProfileUser | undefined
  if (!person) return null

  let viewerId: number | string | null = null
  try {
    viewerId = (await payload.auth({ headers: await headers() })).user?.id ?? null
  } catch {
    /* signed out */
  }
  if (viewerId && String(viewerId) === String(person.id)) return person

  const visibility = person.profileVisibility || 'members'
  if (visibility === 'public') return person
  if (visibility === 'members' && viewerId) return person
  return null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const person = await loadProfile(handle)
  if (!person) return {}
  return {
    title: person.name || handle,
    description: person.bio || undefined,
    // A profile is a person, not content to be ranked.
    robots: { index: false, follow: false },
  }
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>
}) {
  const { locale, handle } = await params
  setRequestLocale(locale)

  const person = await loadProfile(handle)
  if (!person) notFound()

  const badges = (person.badges ?? []).filter((b) => b?.name)

  return (
    <main className="container mx-auto max-w-2xl py-12">
      <header className="flex items-center gap-4">
        {person.avatarUrl ? (
          <Image
            src={person.avatarUrl}
            alt=""
            width={72}
            height={72}
            className="h-18 w-18 rounded-full object-cover"
            unoptimized
          />
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold">{person.name || handle}</h1>
          <p className="text-muted-foreground text-sm">@{handle}</p>
        </div>
      </header>

      {person.bio ? <p className="mt-6 whitespace-pre-line">{person.bio}</p> : null}

      <section className="mt-10">
        <h2 className="text-lg font-medium">Badges</h2>
        {badges.length ? (
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {badges.map((b, i) => (
              <li key={`${b.work}-${i}`} className="rounded-lg border p-4 text-center">
                {b.image ? (
                  <Image src={b.image} alt="" width={64} height={64} className="mx-auto h-16 w-16 object-contain" unoptimized />
                ) : null}
                <p className="mt-2 text-sm font-medium">{b.name}</p>
                {b.awardedAt ? (
                  <p className="text-muted-foreground text-xs">
                    {new Date(b.awardedAt).toLocaleDateString()}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">Nothing earned yet.</p>
        )}
      </section>
    </main>
  )
}
