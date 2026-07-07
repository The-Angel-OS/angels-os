import { setRequestLocale } from 'next-intl/server'
import { getChangelog } from '@/utilities/changelog'
import ChangelogView from './ChangelogView'

/**
 * Changelog — /dashboard/changelog
 *
 * The project's git history as a living changelog: conventional-commit messages
 * pulled live from the public GitHub repo, parsed into typed entries, grouped by
 * day, with type filters + search. Operational transparency — visible to all
 * (like Bridge / CIC). See @/utilities/changelog.
 */
export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  // Cover a few hundred commits — enough for weeks of a busy repo; cached 1h.
  const data = await getChangelog(300)

  return (
    <div className="space-y-6">
      <ChangelogView data={data} />
    </div>
  )
}
