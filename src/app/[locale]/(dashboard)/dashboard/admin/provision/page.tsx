import { setRequestLocale } from 'next-intl/server'
import { ProvisionWizard } from './ProvisionWizard'
import { VerifyOnboardingButton } from './VerifyOnboardingButton'

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

      <div className="mt-10 border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Portal maintenance</h2>
        <VerifyOnboardingButton />
      </div>
    </div>
  )
}
