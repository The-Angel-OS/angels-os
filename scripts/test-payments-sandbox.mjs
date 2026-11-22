#!/usr/bin/env node
/**
 * Angel OS Square Sandbox Bulletproof Test Sweep
 *
 * Exercises live Angel OS payment endpoints + real Square Sandbox Payment Links
 * and Webhook HMAC cryptography across all commerce surfaces without touching
 * real money or printing any secret values.
 *
 * Usage:
 *   node scripts/test-payments-sandbox.mjs
 */
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const APEX_URL = 'https://www.spacesangels.com'
const TENANT_URL = 'https://clearwater-cruisin.spacesangels.com'
const DEFAULT_SERVICE = 'Core'

function parseDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return {}
  const out = {}
  for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq > 0) {
      out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
  }
  return out
}

function loadEnvSecrets() {
  const cmd = process.platform === 'win32' ? 'cmd.exe' : 'railway'
  const args =
    process.platform === 'win32'
      ? ['/c', 'railway', 'variable', 'list', '--service', DEFAULT_SERVICE, '--json']
      : ['variable', 'list', '--service', DEFAULT_SERVICE, '--json']
  const res = spawnSync(cmd, args, { encoding: 'utf-8' })
  let railwayVars = {}
  if (res.status === 0 && res.stdout) {
    try {
      railwayVars = JSON.parse(res.stdout)
    } catch {
      railwayVars = {}
    }
  }
  const localVars = parseDotEnvLocal()
  return {
    cronSecret: process.env.CRON_SECRET || railwayVars.CRON_SECRET || localVars.CRON_SECRET || '',
    squareWebhookKey:
      process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ||
      railwayVars.SQUARE_WEBHOOK_SIGNATURE_KEY ||
      localVars.SQUARE_WEBHOOK_SIGNATURE_KEY ||
      '',
  }
}

async function httpJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20_000),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { status: res.status, ok: res.ok, json, text }
}

const results = []
async function runCase(name, fn) {
  const started = Date.now()
  try {
    const detail = await fn()
    const ms = Date.now() - started
    results.push({ name, passed: true, ms, detail: detail || '' })
    console.log(`  [PASS] ${name} (${ms}ms)${detail ? ` — ${detail}` : ''}`)
  } catch (err) {
    const ms = Date.now() - started
    const msg = err instanceof Error ? err.message : String(err)
    results.push({ name, passed: false, ms, detail: msg })
    console.error(`  [FAIL] ${name} (${ms}ms) — ${msg}`)
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function main() {
  console.log('\n=== Angel OS Square Sandbox Test Sweep ===')
  const { cronSecret, squareWebhookKey } = loadEnvSecrets()
  console.log(`Apex URL:   ${APEX_URL}`)
  console.log(`Tenant URL: ${TENANT_URL}`)
  console.log(
    `Secrets:    CRON_SECRET=${cronSecret ? '[loaded]' : '[missing]'}, SQUARE_WEBHOOK_SIGNATURE_KEY=${squareWebhookKey ? '[loaded]' : '[missing]'}\n`,
  )

  let donationRef = ''
  let donationCheckoutUrl = ''
  let membershipCheckoutUrl = ''

  // ── A. Rail Discovery, Health & Stripe Retirement ──────────────────────────
  console.log('--- A. Rail Discovery, Health & Stripe Retirement ---')

  await runCase('GET /api/payment-ops/providers -> 200 with square(sandbox)', async () => {
    const r = await httpJson(`${APEX_URL}/api/payment-ops/providers`)
    assert(r.status === 200, `Expected 200, got ${r.status}`)
    assert(r.json?.ok === true, 'ok !== true')
    const sq = r.json?.providers?.find((p) => p.id === 'square')
    assert(sq && sq.environment === 'sandbox', `Missing square(sandbox) in ${r.text}`)
    assert(r.json?.defaultProvider === 'square', `Unexpected defaultProvider: ${r.json?.defaultProvider}`)
    return `default=${r.json.defaultProvider}, providers=[${r.json.providers.map((p) => `${p.id}:${p.environment}`).join(', ')}]`
  })

  await runCase('GET /api/payment-ops/setup without auth -> 403', async () => {
    const r = await httpJson(`${APEX_URL}/api/payment-ops/setup`)
    assert(r.status === 403, `Expected 403, got ${r.status}`)
  })

  await runCase('GET /api/payment-ops/setup (authorized) -> 200 & square healthy', async () => {
    assert(cronSecret, 'CRON_SECRET not found in env or Railway Core')
    const r = await httpJson(`${APEX_URL}/api/payment-ops/setup`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    assert(r.status === 200, `Expected 200, got ${r.status}: ${r.text}`)
    assert(r.json?.ready === true, `ready !== true: ${r.text}`)
    assert(r.json?.rails?.square?.healthy === true, `Square unhealthy: ${JSON.stringify(r.json?.rails?.square)}`)
    assert(r.json?.rails?.square?.webhookConfigured === true, 'webhookConfigured !== true')
    assert(Array.isArray(r.json?.rails?.square?.errors) && r.json.rails.square.errors.length === 0, 'Square errors non-empty')
    return `merchant=${r.json.rails.square.merchantOrAppName}, location=${r.json.rails.square.locationId}`
  })

  await runCase('Retired Stripe routes (/api/stripe/*) -> all 410 Gone', async () => {
    const retired = [
      '/api/stripe/webhooks',
      '/api/stripe/connect/onboard',
      '/api/stripe/connect/callback',
      '/api/stripe/connect/dashboard-link',
      '/api/stripe/connect/disconnect',
    ]
    for (const p of retired) {
      const r = await httpJson(`${APEX_URL}${p}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      assert(r.status === 410, `${p} returned HTTP ${r.status} instead of 410`)
    }
    return `5/5 routes return 410`
  })

  // ── B. Donation Checkout, Validation & Confirm Guards ──────────────────────
  console.log('\n--- B. Donation Checkout, Validation & Confirm Guards ---')

  await runCase('Donation rejects below $5.00 minimum (499 cents -> 400)', async () => {
    const r = await httpJson(`${TENANT_URL}/api/donation-ops/create-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 499 }),
    })
    assert(r.status === 400, `Expected 400, got ${r.status}: ${r.text}`)
  })

  await runCase('Donation rejects fractional cents (25.5 -> 400)', async () => {
    const r = await httpJson(`${TENANT_URL}/api/donation-ops/create-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 25.5 }),
    })
    assert(r.status === 400, `Expected 400, got ${r.status}: ${r.text}`)
  })

  await runCase('Donation rejects above $10,000 max (1500000 -> 400)', async () => {
    const r = await httpJson(`${TENANT_URL}/api/donation-ops/create-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1_500_000 }),
    })
    assert(r.status === 400, `Expected 400, got ${r.status}: ${r.text}`)
  })

  await runCase('Donation valid $5.00 -> creates live Square Sandbox checkoutUrl', async () => {
    const r = await httpJson(`${TENANT_URL}/api/donation-ops/create-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 500,
        donorName: 'Sandbox Sweep',
        donorEmail: 'sandbox-test@spacesangels.com',
        message: 'Automated Square Sandbox Sweep',
        provider: 'square',
      }),
    })
    assert(r.status === 200, `Expected 200, got ${r.status}: ${r.text}`)
    assert(r.json?.ok === true && r.json?.provider === 'square', `Unexpected payload: ${r.text}`)
    assert(typeof r.json?.ref === 'string' && r.json.ref.length >= 16, 'Missing checkout ref')
    assert(typeof r.json?.checkoutUrl === 'string' && /square\.link/i.test(r.json.checkoutUrl), `Unexpected checkoutUrl: ${r.json?.checkoutUrl}`)
    donationRef = r.json.ref
    donationCheckoutUrl = r.json.checkoutUrl
    return `ref=${donationRef}, externalId=${r.json.externalId}`
  })

  await runCase('Generated Donation checkoutUrl is live & reachable', async () => {
    assert(donationCheckoutUrl, 'No donation checkoutUrl generated')
    const r = await fetch(donationCheckoutUrl, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    assert(r.status >= 200 && r.status < 400, `Expected 2xx/3xx from Square Link, got ${r.status}`)
    return `HTTP ${r.status}`
  })

  await runCase('Unpaid donation ref refuses premature confirmation', async () => {
    assert(donationRef, 'No donation ref generated')
    const r = await httpJson(`${APEX_URL}/api/payment-ops/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: donationRef }),
    })
    assert(r.json?.ok === false, `Unpaid ref unexpectedly succeeded: ${r.text}`)
    return `status=${r.json?.status || r.status}`
  })

  await runCase('Unknown checkout ref returns 404 on /confirm', async () => {
    const r = await httpJson(`${APEX_URL}/api/payment-ops/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'nonexistent_ref_000000000000' }),
    })
    assert(r.status === 404, `Expected 404, got ${r.status}: ${r.text}`)
  })

  // ── C. Recurring Membership Checkout (Square Catalog Plan + Payment Link) ──
  console.log('\n--- C. Recurring Membership Checkout (Square Catalog Subscriptions) ---')

  await runCase('GET /api/membership-ops/plans -> returns Clearwater plans', async () => {
    const r = await httpJson(`${TENANT_URL}/api/membership-ops/plans`)
    assert(r.status === 200, `Expected 200, got ${r.status}`)
    const plans = r.json?.plans || []
    assert(plans.some((p) => p.id === 'founding-dollar'), 'Missing founding-dollar plan')
    return `${plans.length} plans`
  })

  await runCase('Membership checkout rejects unknown planId -> 404', async () => {
    const r = await httpJson(`${TENANT_URL}/api/membership-ops/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'nonexistent-plan-xyz', tenantSlug: 'clearwater-cruisin' }),
    })
    assert(r.status === 404, `Expected 404, got ${r.status}: ${r.text}`)
  })

  await runCase('Membership recurring checkout (founding-dollar) -> live Square Subscription Link', async () => {
    const r = await httpJson(`${TENANT_URL}/api/membership-ops/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: 'founding-dollar',
        tenantSlug: 'clearwater-cruisin',
        memberName: 'Sandbox Member',
        memberEmail: 'sandbox-member@spacesangels.com',
        provider: 'square',
      }),
    })
    assert(r.status === 200, `Expected 200, got ${r.status}: ${r.text}`)
    assert(r.json?.ok === true && r.json?.provider === 'square', `Unexpected payload: ${r.text}`)
    assert(typeof r.json?.checkoutUrl === 'string' && /square\.link/i.test(r.json.checkoutUrl), `Unexpected URL: ${r.json?.checkoutUrl}`)
    membershipCheckoutUrl = r.json.checkoutUrl
    return `ref=${r.json.ref}, externalId=${r.json.externalId}`
  })

  await runCase('Generated Membership checkoutUrl is live & reachable', async () => {
    assert(membershipCheckoutUrl, 'No membership checkoutUrl generated')
    const r = await fetch(membershipCheckoutUrl, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    assert(r.status >= 200 && r.status < 400, `Expected 2xx/3xx from Square Link, got ${r.status}`)
    return `HTTP ${r.status}`
  })

  await runCase('Membership second checkout hits cached Catalog variation cleanly', async () => {
    const r = await httpJson(`${TENANT_URL}/api/membership-ops/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: 'founding-dollar',
        tenantSlug: 'clearwater-cruisin',
        memberEmail: 'sandbox-member2@spacesangels.com',
        provider: 'square',
      }),
    })
    assert(r.status === 200 && r.json?.checkoutUrl, `2nd checkout failed: ${r.text}`)
    return `ref=${r.json.ref}`
  })

  // ── D. Live Square Webhook Cryptography ─────────────────────────────────────
  console.log('\n--- D. Live Square Webhook HMAC-SHA256 Cryptography ---')

  await runCase('Webhook rejects missing signature -> 401', async () => {
    const r = await httpJson(`${APEX_URL}/api/payment-ops/webhooks/square`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: 'evt_missing', type: 'merchant.profile.updated', data: {} }),
    })
    assert(r.status === 401, `Expected 401, got ${r.status}: ${r.text}`)
  })

  await runCase('Webhook rejects forged HMAC signature -> 401', async () => {
    const r = await httpJson(`${APEX_URL}/api/payment-ops/webhooks/square`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-square-hmacsha256-signature': 'Zm9yZ2VkX3NpZ25hdHVyZQ==',
      },
      body: JSON.stringify({ event_id: 'evt_forged', type: 'merchant.profile.updated', data: {} }),
    })
    assert(r.status === 401, `Expected 401, got ${r.status}: ${r.text}`)
  })

  await runCase('Webhook accepts valid HMAC-SHA256 signature -> 200 received:true', async () => {
    assert(squareWebhookKey, 'SQUARE_WEBHOOK_SIGNATURE_KEY not found in env or Railway Core')
    const webhookUrl = `${APEX_URL}/api/payment-ops/webhooks/square`
    const rawBody = JSON.stringify({
      event_id: `evt_sandbox_smoke_${Date.now()}`,
      type: 'merchant.profile.updated',
      data: {},
    })
    const sig = crypto
      .createHmac('sha256', squareWebhookKey)
      .update(webhookUrl + rawBody)
      .digest('base64')
    const r = await httpJson(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-square-hmacsha256-signature': sig,
      },
      body: rawBody,
    })
    assert(r.status === 200 && r.json?.received === true, `Expected 200 received:true, got ${r.status}: ${r.text}`)
    return `ignored=${Boolean(r.json?.ignored)}`
  })

  // ── E. Auth & Validation Guards Across Remaining Surfaces ──────────────────
  console.log('\n--- E. Auth & Validation Guards Across Remaining Surfaces ---')

  await runCase('Shop checkout missing cartId -> 400', async () => {
    const r = await httpJson(`${APEX_URL}/api/payment-ops/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerEmail: 'test@example.com' }),
    })
    assert(r.status === 400, `Expected 400, got ${r.status}`)
  })

  await runCase('Booking checkout unauthenticated -> 401', async () => {
    const r = await httpJson(`${TENANT_URL}/api/booking-ops/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-12-01', time: '10:00', serviceId: 'test' }),
    })
    assert(r.status === 401, `Expected 401, got ${r.status}`)
  })

  await runCase('Booking confirm unauthenticated -> 401', async () => {
    const r = await httpJson(`${TENANT_URL}/api/booking-ops/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: 1 }),
    })
    assert(r.status === 401, `Expected 401, got ${r.status}`)
  })

  await runCase('Portal plan & Square OAuth endpoints unauthenticated -> 401', async () => {
    for (const p of [
      '/api/plan-ops/checkout',
      '/api/payment-ops/square/connect',
      '/api/payment-ops/square/disconnect',
    ]) {
      const r = await httpJson(`${APEX_URL}${p}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      assert(r.status === 401, `${p} returned ${r.status} instead of 401`)
    }
    return `3/3 routes enforce 401`
  })

  // ── F. Storefront Zero-Stripe HTML Checks ───────────────────────────────────
  console.log('\n--- F. Storefront Pages & Zero-Stripe HTML Verification ---')

  await runCase('Clearwater /donate, /support, /checkout, /book -> 200 & zero js.stripe.com', async () => {
    for (const p of ['/donate', '/support', '/checkout', '/book']) {
      const r = await fetch(`${TENANT_URL}${p}`, { signal: AbortSignal.timeout(20_000) })
      assert(r.status === 200, `${p} returned HTTP ${r.status}`)
      const html = await r.text()
      assert(!/js\.stripe\.com/i.test(html), `${p} still references js.stripe.com!`)
    }
    return `4/4 pages HTTP 200, zero Stripe scripts`
  })

  // ── Summary ─────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length
  const total = results.length
  console.log(`\n=== Summary: ${passed}/${total} checks PASSED ===`)
  if (donationCheckoutUrl) {
    console.log(`Live Sandbox Donation Link:   ${donationCheckoutUrl}`)
  }
  if (membershipCheckoutUrl) {
    console.log(`Live Sandbox Membership Link: ${membershipCheckoutUrl}`)
  }
  console.log('')

  if (passed !== total) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Sandbox sweep crashed:', err?.message || err)
  process.exit(1)
})
