import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { loadCourse } from '@/utilities/courseChapters'
import { canManageWork } from '@/access/canManageWork'
import { CourseStudio } from '@/components/CourseStudio'

export const dynamic = 'force-dynamic'

/**
 * Edit a Work that already exists.
 *
 * The Works Studio could create a Work and the Library shelf could hide or show
 * one, but nothing could change a published Work's content — the CourseStudio
 * existed only as a block someone had to place on a page. For the employee-
 * training case that is the whole job: a manager needs to fix a lesson, or fix
 * a question LEO generated. This is that door.
 *
 * ponytail: reuses the CourseStudio and its one save endpoint verbatim. The
 * route only resolves the Work and answers "may you edit it".
 */
export default async function EditWorkPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const prefix = locale === 'en' ? '' : `/${locale}`

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  // Same loop-proof landing as the Works Studio: never redirect to /login.
  if (!user) redirect(`${prefix}/dashboard`)

  const res = await payload.find({
    collection: 'works',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const work = res.docs?.[0] as unknown as { id: number; title?: string; owner?: string } | undefined
  if (!work) notFound()

  if (!(await canManageWork(payload, user, work.owner))) redirect(`${prefix}/dashboard/works`)

  return (
    <div className="mx-auto max-w-5xl">
      <a href={`${prefix}/dashboard/works`} className="text-sm text-muted-foreground hover:underline">
        ← Back to the Library
      </a>
      <CourseStudio soulId={slug} title={work.title} initial={await loadCourse(payload, work.id)} />
    </div>
  )
}
