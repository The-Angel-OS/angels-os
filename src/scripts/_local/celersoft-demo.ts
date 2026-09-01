/**
 * Celersoft LLC — the B2B demo site.
 *
 * A replica of celersoft.com built on the platform, for a partnership pitch to
 * Raj Veepuri. Same offerings, same three offices, same SOC 2 assessment — but
 * the assessment actually captures, the careers page can hold jobs, and the
 * whole thing is editable by someone who is not a developer. That contrast IS
 * the pitch, so the site has to be standing before the email goes out.
 *
 * Deliberately NOT passing `email`. runDemoSite invites the owner when it has
 * an address, and mailing Raj an "accept to manage your site" link before Ken
 * has said a word to him is not a demo, it is a cold provisioning notice. Ken
 * sends the email; the invite is a later, separate decision.
 *
 *   pnpm payload run src/scripts/_local/celersoft-demo.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { runDemoSite } from '@/utilities/runDemoSite'

const payload = await getPayload({ config })

const result = await runDemoSite(payload, {
  businessName: 'Celersoft LLC',
  slug: 'celersoft',
  trade: 'enterprise IT services and consulting',
  city: 'Houston, TX',
  phone: '(+1) 832-225-8898',
  tagline: 'Empowering businesses to navigate the future with confidence.',
  generateHero: true,
})

console.log(JSON.stringify(result, null, 2))
if (!result.ok) process.exit(1)
