import { redirect } from 'next/navigation'

/**
 * Legacy /help redirect → Dashboard Support Center (/dashboard/support).
 * Help & Support lives inside the security-aware Dashboard rather than on the
 * public brochure header.
 */
export default async function HelpRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect(locale === 'en' ? '/dashboard/support' : `/${locale}/dashboard/support`)
}
