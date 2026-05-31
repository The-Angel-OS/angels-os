import { setRequestLocale } from 'next-intl/server'
import LearnExperience from '@/components/Learn/LearnExperience'

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
  return <LearnExperience />
}
