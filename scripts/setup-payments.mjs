#!/usr/bin/env node
/**
 * Angel OS Dual-Rail Payment Setup & Live Verification CLI
 *
 * Configures Square (primary + multi-tenant OAuth) and PayPal/Venmo (companion)
 * with zero manual ID hunting and automatic Sandbox-vs-Production mismatch checks:
 *   - Validates Square access token across Sandbox & Production /v2/locations
 *   - Auto-discovers SQUARE_LOCATION_ID and merchant business name
 *   - Auto-registers Square webhook -> captures SQUARE_WEBHOOK_SIGNATURE_KEY
 *   - Validates PayPal Client ID + Secret across Sandbox & Production OAuth2
 *   - Auto-registers PayPal webhook -> captures PAYPAL_WEBHOOK_ID
 *   - Writes secrets cleanly to Railway Core via stdin (--skip-deploys until final)
 *   - Detects and removes dead STRIPE_* variables on confirmation
 *
 * Usage:
 *   node scripts/setup-payments.mjs          # interactive setup
 *   node scripts/setup-payments.mjs --audit  # read-only live audit of Railway Core
 */
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_BASE_URL = 'https://spacesangels.com'
const DEFAULT_SERVICE = 'Core'
const SQUARE_VERSION = '2025-10-16'

const SQUARE_WEBHOOK_EVENTS = [
  'payment.completed',
  'payment.updated',
  'subscription.created',
  'subscription.updated',
  'invoice.payment_made',
  'refund.created',
]

const PAYPAL_WEBHOOK_EVENTS = [
  { name: 'PAYMENT.CAPTURE.COMPLETED' },
  { name: 'PAYMENT.CAPTURE.REFUNDED' },
  { name: 'BILLING.SUBSCRIPTION.ACTIVATED' },
  { name: 'BILLING.SUBSCRIPTION.UPDATED' },
  { name: 'BILLING.SUBSCRIPTION.CANCELLED' },
  { name: 'BILLING.SUBSCRIPTION.SUSPENDED' },
  { name: 'PAYMENT.SALE.COMPLETED' },
]

const LEFTOVER_STRIPE_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOKS_SIGNING_SECRET',
  'STRIPE_CONNECT_WEBHOOK_SECRET',
]

function maskSecret(val) {
  if (!val || typeof val !== 'string') return '(not set)'
  if (val.length <= 10) return '****'
  return `${val.slice(0, 4)}...${val.slice(-4)}`
}

function squareBaseUrl(env) {
  return env === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com'
}

function paypalBaseUrl(env) {
  return env === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
}

function parseArgs() {
  const args = process.argv.slice(2)
  const auditOnly = args.includes('--audit')
  const serviceIdx = args.indexOf('--service')
  const service = serviceIdx >= 0 && args[serviceIdx + 1] ? args[serviceIdx + 1] : DEFAULT_SERVICE
  return { auditOnly, service }
}

function runRailway(args, input) {
  const cmd = process.platform === 'win32' ? 'cmd.exe' : 'railway'
  const fullArgs = process.platform === 'win32' ? ['/c', 'railway', ...args] : args
  return spawnSync(cmd, fullArgs, {
    ...(input !== undefined ? { input } : {}),
    encoding: 'utf-8',
  })
}

function loadRailwayVars(service) {
  const res = runRailway(['variable', 'list', '--service', service, '--json'])
  if (res.status !== 0 || !res.stdout) {
    return { ok: false, vars: {}, error: (res.stderr || res.stdout || 'railway CLI unavailable').trim() }
  }
  try {
    const parsed = JSON.parse(res.stdout)
    return { ok: true, vars: parsed && typeof parsed === 'object' ? parsed : {} }
  } catch (err) {
    return { ok: false, vars: {}, error: `Invalid JSON from railway variable list: ${err.message}` }
  }
}

function setRailwayVarStdin(service, key, value, skipDeploys = true) {
  const args = ['variable', 'set', key, '--stdin', '--service', service]
  if (skipDeploys) args.push('--skip-deploys')
  const res = runRailway(args, value)
  return res.status === 0
}

function deleteRailwayVar(service, key) {
  const res = runRailway(['variable', 'delete', key, '--service', service])
  return res.status === 0
}

async function fetchSquareLocations(accessToken, env) {
  const res = await fetch(`${squareBaseUrl(env)}/v2/locations`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Square-Version': SQUARE_VERSION,
    },
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) return { ok: false, status: res.status, locations: [] }
  const data = await res.json()
  return { ok: true, status: res.status, locations: data.locations || [] }
}

async function detectSquareToken(accessToken) {
  for (const env of ['production', 'sandbox']) {
    const check = await fetchSquareLocations(accessToken, env).catch(() => ({ ok: false, locations: [] }))
    if (check.ok) {
      let merchantName = ''
      try {
        const me = await fetch(`${squareBaseUrl(env)}/v2/merchants/me`, {
          headers: { Authorization: `Bearer ${accessToken}`, 'Square-Version': SQUARE_VERSION },
          signal: AbortSignal.timeout(8_000),
        })
        if (me.ok) {
          const meData = await me.json()
          merchantName = meData?.merchant?.business_name || ''
        }
      } catch {
        /* ignore */
      }
      const activeLocations = check.locations.filter((l) => !l.status || l.status === 'ACTIVE')
      return {
        valid: true,
        environment: env,
        merchantName,
        locations: activeLocations.length > 0 ? activeLocations : check.locations,
      }
    }
  }
  return { valid: false, environment: null, merchantName: '', locations: [] }
}

async function ensureSquareWebhook(accessToken, env, webhookUrl) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Square-Version': SQUARE_VERSION,
    'Content-Type': 'application/json',
  }
  const listRes = await fetch(`${squareBaseUrl(env)}/v2/webhooks/subscriptions`, {
    headers,
    signal: AbortSignal.timeout(12_000),
  })
  if (listRes.ok) {
    const listData = await listRes.json()
    const existing = (listData.subscriptions || []).find((s) => s.notification_url === webhookUrl)
    if (existing?.id) {
      return {
        id: existing.id,
        signatureKey: existing.signature_key || null,
        created: false,
      }
    }
  }

  const createRes = await fetch(`${squareBaseUrl(env)}/v2/webhooks/subscriptions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      idempotency_key: `angel-os-webhook-${Date.now()}`,
      subscription: {
        name: 'Angel OS Payments Webhook',
        enabled: true,
        event_types: SQUARE_WEBHOOK_EVENTS,
        notification_url: webhookUrl,
      },
    }),
    signal: AbortSignal.timeout(12_000),
  })
  const createData = await createRes.json().catch(() => ({}))
  if (!createRes.ok || !createData?.subscription?.id) {
    throw new Error(createData?.errors?.[0]?.detail || `Square webhook HTTP ${createRes.status}`)
  }
  return {
    id: createData.subscription.id,
    signatureKey: createData.subscription.signature_key || null,
    created: true,
  }
}

async function fetchPayPalToken(clientId, clientSecret, env) {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(`${paypalBaseUrl(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) return { ok: false, accessToken: null, appId: null }
  const data = await res.json()
  return { ok: true, accessToken: data.access_token, appId: data.app_id || null }
}

async function detectPayPalCredentials(clientId, clientSecret) {
  for (const env of ['production', 'sandbox']) {
    const tok = await fetchPayPalToken(clientId, clientSecret, env).catch(() => ({ ok: false }))
    if (tok.ok && tok.accessToken) {
      return { valid: true, environment: env, accessToken: tok.accessToken, appId: tok.appId }
    }
  }
  return { valid: false, environment: null, accessToken: null, appId: null }
}

async function ensurePayPalWebhook(accessToken, env, webhookUrl) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
  const listRes = await fetch(`${paypalBaseUrl(env)}/v1/notifications/webhooks`, {
    headers,
    signal: AbortSignal.timeout(12_000),
  })
  if (listRes.ok) {
    const listData = await listRes.json()
    const existing = (listData.webhooks || []).find((w) => w.url === webhookUrl)
    if (existing?.id) {
      return { id: existing.id, created: false }
    }
  }

  const createRes = await fetch(`${paypalBaseUrl(env)}/v1/notifications/webhooks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      url: webhookUrl,
      event_types: PAYPAL_WEBHOOK_EVENTS,
    }),
    signal: AbortSignal.timeout(12_000),
  })
  const createData = await createRes.json().catch(() => ({}))
  if (!createRes.ok || !createData?.id) {
    throw new Error(createData?.message || `PayPal webhook HTTP ${createRes.status}`)
  }
  return { id: createData.id, created: true }
}

function updateLocalEnvFile(updates) {
  const envPath = path.resolve(process.cwd(), '.env.local')
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : ''
  const lines = existing ? existing.split(/\r?\n/) : []
  const map = new Map()
  const order = []

  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) {
      map.set(m[1], line)
      order.push(m[1])
    } else if (line.trim() !== '') {
      order.push(line)
    }
  }

  for (const [k, v] of Object.entries(updates)) {
    if (!v) continue
    const formatted = `${k}=${v}`
    if (!map.has(k)) order.push(k)
    map.set(k, formatted)
  }

  const out = order.map((item) => (map.has(item) ? map.get(item) : item)).join('\n') + '\n'
  fs.writeFileSync(envPath, out, 'utf-8')
}

async function runAudit(service, railway) {
  const vars = railway.ok ? railway.vars : process.env
  const baseUrl = vars.NEXT_PUBLIC_SERVER_URL || DEFAULT_BASE_URL

  console.log('\n=== Angel OS Dual-Rail Payment Audit ===')
  console.log(`Target service: ${service} (${railway.ok ? 'Railway linked' : `local env fallback: ${railway.error}`})`)
  console.log(`Canonical URL:  ${baseUrl}`)

  const leftoverStripe = LEFTOVER_STRIPE_KEYS.filter((k) => Boolean(vars[k]))
  console.log(
    `Leftover STRIPE_* vars: ${leftoverStripe.length > 0 ? leftoverStripe.join(', ') : 'None (clean)'}`,
  )

  // Live check Square
  let squareHealthy = false
  if (vars.SQUARE_ACCESS_TOKEN) {
    const det = await detectSquareToken(vars.SQUARE_ACCESS_TOKEN)
    if (det.valid) {
      const configuredEnv = vars.SQUARE_ENVIRONMENT || 'production'
      const mismatch = det.environment !== configuredEnv
      console.log(
        `Square: VALID (${det.environment}${mismatch ? ` — MISMATCH with SQUARE_ENVIRONMENT=${configuredEnv}!` : ''}) · Merchant: ${det.merchantName || '(unnamed)'} · Locations: ${det.locations.length}`,
      )
      squareHealthy = !mismatch && det.locations.length > 0
    } else {
      console.log(`Square: INVALID TOKEN (${maskSecret(vars.SQUARE_ACCESS_TOKEN)}) in both production and sandbox`)
    }
  } else {
    console.log('Square: NOT CONFIGURED (SQUARE_ACCESS_TOKEN missing)')
  }

  // Live check PayPal
  let paypalHealthy = false
  if (vars.PAYPAL_CLIENT_ID && vars.PAYPAL_CLIENT_SECRET) {
    const det = await detectPayPalCredentials(vars.PAYPAL_CLIENT_ID, vars.PAYPAL_CLIENT_SECRET)
    if (det.valid) {
      const configuredEnv = vars.PAYPAL_ENVIRONMENT || 'production'
      const mismatch = det.environment !== configuredEnv
      console.log(
        `PayPal: VALID (${det.environment}${mismatch ? ` — MISMATCH with PAYPAL_ENVIRONMENT=${configuredEnv}!` : ''}) · App ID: ${det.appId || '(default)'}`,
      )
      paypalHealthy = !mismatch
    } else {
      console.log('PayPal: INVALID CLIENT_ID / CLIENT_SECRET in both production and sandbox')
    }
  } else {
    console.log('PayPal: NOT CONFIGURED (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing)')
  }

  // Check live endpoint
  try {
    const liveRes = await fetch(`${baseUrl}/api/payment-ops/providers`, {
      signal: AbortSignal.timeout(8_000),
    })
    if (liveRes.ok) {
      const liveData = await liveRes.json()
      const names = (liveData.providers || []).map((p) => `${p.id}(${p.environment})`).join(', ')
      console.log(`Live ${baseUrl}/api/payment-ops/providers -> HTTP ${liveRes.status}: [${names || 'none configured yet'}]`)
    } else {
      console.log(`Live ${baseUrl}/api/payment-ops/providers -> HTTP ${liveRes.status}`)
    }
  } catch (err) {
    console.log(`Live endpoint probe skipped/unreachable: ${err.message}`)
  }

  console.log('\nRequired OAuth / Webhook URLs:')
  console.log(`  Square OAuth Redirect: ${baseUrl}/api/payment-ops/square/callback`)
  console.log(`  Square Webhook URL:    ${baseUrl}/api/payment-ops/webhooks/square`)
  console.log(`  PayPal Webhook URL:    ${baseUrl}/api/payment-ops/webhooks/paypal`)
  console.log('')

  return { squareHealthy, paypalHealthy, leftoverStripe }
}

async function runInteractive() {
  const { auditOnly, service } = parseArgs()
  const railway = loadRailwayVars(service)

  if (auditOnly) {
    const audit = await runAudit(service, railway)
    process.exitCode = audit.squareHealthy || audit.paypalHealthy ? 0 : 1
    return
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const vars = railway.ok ? railway.vars : {}
    const defaultBase = vars.NEXT_PUBLIC_SERVER_URL || DEFAULT_BASE_URL
    console.log('\n=== Angel OS Automated Dual-Rail Payment Setup ===')
    if (!railway.ok) {
      console.log(`Warning: Railway CLI could not read service "${service}" (${railway.error}).`)
      console.log('We can still validate your keys live and save them to .env.local.\n')
    } else {
      console.log(`Connected to Railway service "${service}". Current secrets are masked.\n`)
    }

    const baseInput = (await rl.question(`Platform canonical URL [${defaultBase}]: `)).trim()
    const baseUrl = (baseInput || defaultBase).replace(/\/+$/, '')

    const updates = {}

    // ── 1. Square Setup ───────────────────────────────────────────────────────
    console.log('\n--- Step 1: Square (Cards, Apple Pay, Google Pay + Multi-Tenant OAuth) ---')
    console.log('Open: https://developer.squareup.com/apps -> select your App')
    console.log(`OAuth Redirect URL to paste into Square Dashboard -> OAuth:`)
    console.log(`  ${baseUrl}/api/payment-ops/square/callback`)

    const currentSqTok = vars.SQUARE_ACCESS_TOKEN || ''
    const sqTokPrompt = currentSqTok
      ? `Square Access Token (Enter to keep ${maskSecret(currentSqTok)}, or paste new, or "-" to skip): `
      : 'Square Access Token (Production or Sandbox, or "-" to skip): '
    const sqTokRaw = (await rl.question(sqTokPrompt)).trim()
    const sqToken = sqTokRaw === '-' ? '' : sqTokRaw || currentSqTok

    if (sqToken) {
      process.stdout.write('Validating Square token against Production & Sandbox... ')
      const det = await detectSquareToken(sqToken)
      if (!det.valid) {
        console.log('FAILED (token rejected by both Production and Sandbox Square APIs).')
      } else {
        console.log(`OK! Detected ${det.environment.toUpperCase()} (${det.merchantName || 'Square Merchant'})`)
        updates.SQUARE_ACCESS_TOKEN = sqToken
        updates.SQUARE_ENVIRONMENT = det.environment

        if (det.locations.length === 1) {
          updates.SQUARE_LOCATION_ID = det.locations[0].id
          console.log(`Auto-selected Location ID: ${det.locations[0].id} (${det.locations[0].name || 'Default'})`)
        } else if (det.locations.length > 1) {
          console.log('Available Square Locations:')
          det.locations.forEach((l, idx) => {
            console.log(`  [${idx + 1}] ${l.id} — ${l.name || 'Unnamed'}`)
          })
          const pick = (await rl.question(`Choose location [1-${det.locations.length}, default 1]: `)).trim()
          const chosen = det.locations[Math.max(0, (parseInt(pick, 10) || 1) - 1)] || det.locations[0]
          updates.SQUARE_LOCATION_ID = chosen.id
        } else {
          console.log('Warning: No active Square Locations found on this account.')
        }

        // OAuth credentials for Multi-Tenant Endeavors
        const currentAppId = vars.SQUARE_APPLICATION_ID || ''
        const appIdInput = (
          await rl.question(
            `Square Application ID (for multi-tenant OAuth${currentAppId ? `, Enter to keep ${maskSecret(currentAppId)}` : ', or Enter to skip'}): `,
          )
        ).trim()
        const finalAppId = appIdInput || currentAppId
        if (finalAppId) updates.SQUARE_APPLICATION_ID = finalAppId

        const currentAppSecret = vars.SQUARE_APPLICATION_SECRET || ''
        const appSecretInput = (
          await rl.question(
            `Square OAuth Application Secret (${currentAppSecret ? `Enter to keep ${maskSecret(currentAppSecret)}` : 'Enter to skip'}): `,
          )
        ).trim()
        const finalAppSecret = appSecretInput || currentAppSecret
        if (finalAppSecret) updates.SQUARE_APPLICATION_SECRET = finalAppSecret

        // Auto-register Square webhook
        const sqWebhookUrl = `${baseUrl}/api/payment-ops/webhooks/square`
        try {
          process.stdout.write(`Ensuring Square webhook (${sqWebhookUrl})... `)
          const wh = await ensureSquareWebhook(sqToken, det.environment, sqWebhookUrl)
          if (wh.signatureKey) {
            updates.SQUARE_WEBHOOK_SIGNATURE_KEY = wh.signatureKey
            console.log(`${wh.created ? 'CREATED' : 'FOUND'} (signature key captured!)`)
          } else {
            console.log(`${wh.created ? 'CREATED' : 'FOUND'}`)
          }
        } catch (err) {
          console.log(`SKIPPED/WARNING: ${err.message}`)
        }
      }
    }

    // ── 2. PayPal Setup ───────────────────────────────────────────────────────
    console.log('\n--- Step 2: PayPal / Venmo Companion Rail ---')
    console.log('Open: https://developer.paypal.com/dashboard/applications/live -> REST API apps')

    const currentPpId = vars.PAYPAL_CLIENT_ID || ''
    const ppIdRaw = (
      await rl.question(
        `PayPal Client ID (${currentPpId ? `Enter to keep ${maskSecret(currentPpId)}, ` : ''}or "-" to skip): `,
      )
    ).trim()
    const ppClientId = ppIdRaw === '-' ? '' : ppIdRaw || currentPpId

    const currentPpSec = vars.PAYPAL_CLIENT_SECRET || ''
    let ppSecret = ''
    if (ppClientId) {
      const ppSecRaw = (
        await rl.question(
          `PayPal Client Secret (${currentPpSec ? `Enter to keep ${maskSecret(currentPpSec)}` : 'paste secret'}): `,
        )
      ).trim()
      ppSecret = ppSecRaw || currentPpSec
    }

    if (ppClientId && ppSecret) {
      process.stdout.write('Validating PayPal OAuth2 credentials across Production & Sandbox... ')
      const det = await detectPayPalCredentials(ppClientId, ppSecret)
      if (!det.valid) {
        console.log('FAILED (credentials rejected by both Production and Sandbox PayPal APIs).')
      } else {
        console.log(`OK! Detected ${det.environment.toUpperCase()}`)
        updates.PAYPAL_CLIENT_ID = ppClientId
        updates.PAYPAL_CLIENT_SECRET = ppSecret
        updates.PAYPAL_ENVIRONMENT = det.environment

        const ppWebhookUrl = `${baseUrl}/api/payment-ops/webhooks/paypal`
        try {
          process.stdout.write(`Ensuring PayPal webhook (${ppWebhookUrl})... `)
          const wh = await ensurePayPalWebhook(det.accessToken, det.environment, ppWebhookUrl)
          updates.PAYPAL_WEBHOOK_ID = wh.id
          console.log(`${wh.created ? 'CREATED' : 'FOUND'} (Webhook ID: ${wh.id})`)
        } catch (err) {
          console.log(`SKIPPED/WARNING: ${err.message}`)
        }
      }
    }

    // ── 3. Apply Changes ──────────────────────────────────────────────────────
    const updateKeys = Object.keys(updates)
    if (updateKeys.length > 0 && railway.ok) {
      console.log(`\nReady to push ${updateKeys.length} variables to Railway service "${service}": ${updateKeys.join(', ')}`)
      const confirmPush = (await rl.question('Push these variables to Railway now? [Y/n]: ')).trim().toLowerCase()
      if (confirmPush === '' || confirmPush === 'y' || confirmPush === 'yes') {
        for (let i = 0; i < updateKeys.length; i++) {
          const k = updateKeys[i]
          const isLast = i === updateKeys.length - 1
          const ok = setRailwayVarStdin(service, k, updates[k], !isLast)
          console.log(`  ${k}: ${ok ? 'SET' : 'FAILED'}`)
        }
      }
    }

    if (updateKeys.length > 0) {
      const saveLocal = (await rl.question('Also update local .env.local for dev testing? [y/N]: ')).trim().toLowerCase()
      if (saveLocal === 'y' || saveLocal === 'yes') {
        updateLocalEnvFile(updates)
        console.log('Updated .env.local cleanly.')
      }
    }

    // ── 4. Clean Dead Stripe Vars ─────────────────────────────────────────────
    if (railway.ok) {
      const leftover = LEFTOVER_STRIPE_KEYS.filter((k) => Boolean(vars[k]))
      if (leftover.length > 0) {
        console.log(`\nDetected dead Stripe variables on Railway "${service}": ${leftover.join(', ')}`)
        const rmConfirm = (await rl.question('Remove dead STRIPE_* variables from Railway? [Y/n]: ')).trim().toLowerCase()
        if (rmConfirm === '' || rmConfirm === 'y' || rmConfirm === 'yes') {
          for (const k of leftover) {
            const ok = deleteRailwayVar(service, k)
            console.log(`  Removed ${k}: ${ok ? 'OK' : 'FAILED'}`)
          }
        }
      }
    }

    console.log('\nSetup complete! Next:')
    console.log(`  1. In Square Developer Console -> OAuth, ensure Redirect URL is set to:`)
    console.log(`     ${baseUrl}/api/payment-ops/square/callback`)
    console.log(`  2. Visit ${baseUrl}/dashboard/admin/payments and click "Run Live Rail Health Check"`)
    console.log(`     or re-run: node scripts/setup-payments.mjs --audit`)
  } finally {
    rl.close()
  }
}

runInteractive().catch((err) => {
  console.error('Setup failed:', err?.message || err)
  process.exit(1)
})
