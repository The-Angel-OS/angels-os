import { setRequestLocale } from 'next-intl/server'

export default async function LEOPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">LEO System Intelligence</h1>
      <p className="mb-6 text-muted-foreground">
        Your Guardian Angel – conversational AI for navigation, data entry, and business intelligence.
      </p>
      <div className="rounded-lg border p-6">
        <h2 className="mb-4 font-semibold">Capabilities</h2>
        <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
          <li>Conversational navigation</li>
          <li>Form data entry</li>
          <li>Business intelligence</li>
          <li>Multi-language support (planned)</li>
          <li>Tenant-scoped context</li>
          <li>Voice interface (planned)</li>
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          LEO system users (avatar users) are seeded per tenant. Integrate via ConversationEngine and web-chat API.
        </p>
      </div>
    </div>
  )
}
