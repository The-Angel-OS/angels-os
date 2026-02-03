import { setRequestLocale } from 'next-intl/server'

export default async function SpacesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Spaces</h1>
      <p className="mb-6 text-muted-foreground">
        Discord-like workspace: channels, messages, and workspace apps (Trello board, etc.).
      </p>
      <div className="rounded-lg border p-6">
        <h2 className="mb-4 font-semibold">Coming soon</h2>
        <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
          <li>Left nav with channels you&apos;re in</li>
          <li>Workspace apps (plugins)</li>
          <li>Chat with LEO and team</li>
          <li>PMs and group chats</li>
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          Seed creates Angel OS Community and Angel OS Support spaces with channels and initial messages.
        </p>
      </div>
    </div>
  )
}
