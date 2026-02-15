import { setRequestLocale } from 'next-intl/server'
import { SpacesChat } from './SpacesChat'

export default async function SpacesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Spaces</h1>
        <p className="text-sm text-muted-foreground">
          Channels, messages, and workspace apps. Discord-like collaboration.
        </p>
      </div>
      <div className="flex-1">
        <SpacesChat />
      </div>
    </div>
  )
}
