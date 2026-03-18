import { setRequestLocale } from 'next-intl/server'
import { DonatePage } from './DonatePage'

export const metadata = {
  title: 'Donate to Angel OS',
  description:
    'Support the Angel OS federation. 100% of donations go to the Justice Fund — community support, wrongful conviction advocacy, and guild infrastructure.',
}

export default async function DonatePageRoute({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return <DonatePage />
}
