/* eslint-disable no-restricted-exports */
import { headers } from 'next/headers'
import { fetchTenantByDomain } from '@/utilities/fetchTenantByDomain'
import { isPortalClaimed } from '@/utilities/isPortalClaimed'

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  : 'http://localhost:3000'

export default async function robots() {
  // A portal built FOR a prospect carries their business name before they have
  // agreed to anything. Keep it out of search until someone claims it; the flag
  // flips itself the moment an invite is accepted. @see utilities/isPortalClaimed
  try {
    const host = (await headers()).get('host') || ''
    const tenant = host ? await fetchTenantByDomain(host) : null
    if (tenant && !(await isPortalClaimed(tenant.id))) {
      return { rules: [{ userAgent: '*', disallow: '/' }] }
    }
  } catch {
    // A robots.txt that fails to render is worse than a permissive one.
  }

  // Search engines that send people, and nobody else. Crawler traffic was filling
  // the Site Log (73K rows, 260930); robots.txt is advisory, so the junk that
  // ignores it is handled by the bot-retention prune in log-consolidate.
  return {
    host: baseUrl,
    rules: [
      { userAgent: ['Googlebot', 'Bingbot', 'DuckDuckBot'], allow: '/' },
      { userAgent: '*', disallow: '/' },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
