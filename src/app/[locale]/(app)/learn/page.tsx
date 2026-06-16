import { setRequestLocale } from 'next-intl/server'
import LearnExperience from '@/components/Learn/LearnExperience'
import { getAllSouls } from '@/souls'
import { isWorkAvailable } from '@/souls/subscriptions'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'

export const metadata = {
  title: 'Learn — Angel OS',
  description:
    'Understand Angel OS: a federated cooperative operating system with a constitutional AI guardian. Start here.',
}

export const dynamic = 'force-dynamic'

export default async function LearnPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const { tenant } = await resolveTenantFromHeaders()
  const souls = getAllSouls().filter((s) => isWorkAvailable(s.id, tenant?.slug))
  return <LearnExperience souls={souls} />
}
