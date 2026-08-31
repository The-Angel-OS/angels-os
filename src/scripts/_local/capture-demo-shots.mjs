/**
 * Capture the demo walkthrough as PNGs, anonymously.
 *
 * Playwright rather than the browser extension, for three reasons that each
 * caused a bad shot earlier: a signed-in Chrome shows "Logout / Dashboard /
 * Admin" and an owner-only "You're already set up" panel that no visitor ever
 * sees; the in-app browser's screenshots came back blank when the page was
 * scrolled programmatically; and neither reliably wrote files to disk.
 *
 * A fresh context per run means no NEXT_LOCALE cookie, no session, and no
 * super_admin — which is exactly the site a prospect gets.
 *
 * Run: node src/scripts/_local/capture-demo-shots.mjs
 * Out: docs/demo-shots/NN-name.png
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const OUT = join(ROOT, 'docs', 'demo-shots')
mkdirSync(OUT, { recursive: true })

const BASE = 'https://www.spacesangels.com'
const PAYNE = 'https://paynemediaco.spacesangels.com'

/** 16:9 at a size that stays readable when a slide is projected. */
const VIEWPORT = { width: 1600, height: 900 }

const shots = [
  { n: '01', name: 'home-hero', url: `${BASE}/`, scroll: 0 },
  { n: '02', name: 'home-showcase', url: `${BASE}/`, scrollToText: 'Businesses already running on it' },
  { n: '03', name: 'how-it-works', url: `${BASE}/how-it-works`, scroll: 0 },
  { n: '04', name: 'how-it-works-faq', url: `${BASE}/how-it-works`, scrollToText: 'What is the catch' },
  { n: '05', name: 'examples', url: `${BASE}/examples`, scroll: 0 },
  { n: '06', name: 'get-started', url: `${BASE}/get-started`, scroll: 0 },
  { n: '07', name: 'payne-home', url: `${PAYNE}/`, scroll: 0 },
  { n: '08', name: 'payne-weddings', url: `${PAYNE}/weddings`, scroll: 0 },
  { n: '09', name: 'payne-wedding-post', url: `${PAYNE}/posts/mercyanna-and-jacob`, scroll: 0 },
  { n: '10', name: 'payne-wedding-gallery', url: `${PAYNE}/posts/mercyanna-and-jacob`, scrollToText: 'The Gallery' },
  { n: '11', name: 'payne-film-post', url: `${PAYNE}/posts/char-and-joseph`, scroll: 0, wait: 'domcontentloaded' },
  { n: '12', name: 'payne-book-services', url: `${PAYNE}/book`, scroll: 0 },
  { n: '13', name: 'grace-chapel', url: 'https://grace-chapel.spacesangels.com/', scroll: 0 },
  { n: '14', name: 'clearwater', url: 'https://clearwater-cruisin.spacesangels.com/', scroll: 0 },
  { n: '15', name: 'learn-platform', url: `${BASE}/learn`, scrollToText: 'One Platform, Many Portals' },
  { n: '16', name: 'learn-seed-prompt', url: `${BASE}/learn`, scrollToText: 'How LEO Is Instructed' },
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'en-US', deviceScaleFactor: 2 })
const page = await ctx.newPage()

// Freeze the scroll-reveal animation at its END state for every capture.
// A screenshot is a single instant, and a scroll-driven animation is mid-flight
// at most instants — the first run caught a photo gallery at partial opacity and
// it looked like a rendering fault rather than a design.
await ctx.addInitScript(() => {
  const css = '.block-reveal { animation: none !important; opacity: 1 !important; transform: none !important; }'
  const apply = () => {
    const style = document.createElement('style')
    style.textContent = css
    document.head?.appendChild(style)
  }
  if (document.head) apply()
  else document.addEventListener('DOMContentLoaded', apply)
})

for (const s of shots) {
  try {
    // A Vimeo embed keeps the network busy, so networkidle never fires on the
    // film posts. Those wait for DOM only.
    await page.goto(s.url, { waitUntil: s.wait || 'networkidle', timeout: 60000 })
    // Scroll-driven reveal animations need the element actually in view, and
    // images need a beat to decode. Both are why an immediate shot came back blank.
    if (s.scrollToText) {
      const el = page.getByText(s.scrollToText, { exact: false }).first()
      await el.scrollIntoViewIfNeeded({ timeout: 15000 })
      await page.evaluate(() => window.scrollBy(0, -80))
    }
    await page.waitForTimeout(2500)
    const file = join(OUT, `${s.n}-${s.name}.png`)
    await page.screenshot({ path: file })
    console.log('OK  ', `${s.n}-${s.name}`)
  } catch (err) {
    console.log('FAIL', `${s.n}-${s.name}`, err instanceof Error ? err.message.split('\n')[0] : String(err))
  }
}

// The booking flow needs clicks, so it gets its own pass.
try {
  await page.goto(`${PAYNE}/book`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.getByText('Beach Wedding', { exact: false }).first().click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(OUT, '17-book-pick-date.png') })
  console.log('OK   17-book-pick-date')

  // First enabled date cell that is not today.
  const day = page.locator('button:has-text("Sep"), [role=button]:has-text("Sep")').nth(12)
  await day.click({ timeout: 15000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(OUT, '18-book-pick-time.png') })
  console.log('OK   18-book-pick-time')

  await page.getByText(/^\d{1,2}:\d{2} (AM|PM)$/).first().click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(OUT, '19-book-confirm.png') })
  console.log('OK   19-book-confirm')
} catch (err) {
  console.log('FAIL booking flow', err instanceof Error ? err.message.split('\n')[0] : String(err))
}

await browser.close()
console.log('\nShots written to docs/demo-shots/')
