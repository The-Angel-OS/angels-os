import { setRequestLocale } from 'next-intl/server'
import { ProvisionWizard } from './ProvisionWizard'

export default async function ProvisionPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">New Endeavor</h1>
        <p className="text-sm text-muted-foreground">
          Set up a new tenant with everything you need to start operating.
        </p>
      </div>
      <ProvisionWizard />
    </div>
  )
}
