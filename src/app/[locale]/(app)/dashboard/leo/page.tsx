import { setRequestLocale } from 'next-intl/server'
import { LEOChat } from './LEOChat'

export default async function LEOPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">LEO</h1>
        <p className="text-sm text-muted-foreground">
          Your Guardian Angel &ndash; conversational AI for navigation, data entry, and business
          intelligence.
        </p>
      </div>
      <div className="flex-1">
        <LEOChat />
      </div>
    </div>
  )
}
