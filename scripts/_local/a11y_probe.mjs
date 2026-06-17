import { chromium } from 'playwright'
const browser = await chromium.launch()
const ctx = await browser.newContext()
const page = await ctx.newPage()
await page.goto('https://www.spacesangels.com/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const info = await page.$$eval('button[data-slot="select-trigger"], button[role="combobox"]', els =>
  els.map(e => ({
    cls: e.className,
    text: (e.textContent||'').trim(),
    ariaLabel: e.getAttribute('aria-label'),
    html: e.outerHTML.slice(0, 300),
    parent: e.parentElement?.className,
  }))
)
console.log(JSON.stringify(info, null, 2))
await browser.close()
