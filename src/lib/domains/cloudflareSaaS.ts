/**
 * Cloudflare for SaaS — Custom Hostnames API v4 Client
 *
 * Automates custom domain provisioning, SSL validation status polling, and
 * cleanup for creator portals without per-tenant Railway domain clicks.
 *
 * Required Railway env vars for live Cloudflare calls:
 *   - CLOUDFLARE_ZONE_ID          (Zone ID of spacesangels.com)
 *   - CLOUDFLARE_API_TOKEN        (Token with Zone -> SSL and Certificates -> Edit)
 *   - CLOUDFLARE_SAAS_CNAME_TARGET (Optional, defaults to core.spacesangels.com)
 */
import type { Payload } from 'payload'
import { getJsonSetting, setJsonSetting } from '@/services/SettingService'

const CF_API_BASE = 'https://api.cloudflare.com/client/v4'
const ENTITY_CUSTOM_HOSTNAMES = 'custom-hostnames'
const SETTING_STATUS = 'cf-status'

export interface CloudflareSaaSEnv {
  zoneId: string
  apiToken: string
  cnameTarget: string
}

export interface NormalizedCustomHostnameStatus {
  hostname: string
  cloudflareId?: string
  status: string
  sslStatus: string
  cnameTarget: string
  ownershipVerification?: {
    type?: string
    name?: string
    value?: string
  }
  sslValidationRecords?: Array<{
    status?: string
    txtName?: string
    txtValue?: string
    httpUrl?: string
    httpBody?: string
  }>
  verificationErrors?: string[]
  lastCheckedAt: string
  error?: string
}

export function getCloudflareSaaSEnv(): CloudflareSaaSEnv {
  return {
    zoneId: (process.env.CLOUDFLARE_ZONE_ID || '').trim(),
    apiToken: (process.env.CLOUDFLARE_API_TOKEN || '').trim(),
    cnameTarget: (
      process.env.CLOUDFLARE_SAAS_CNAME_TARGET || 'core.spacesangels.com'
    ).trim(),
  }
}

export function isCloudflareSaaSConfigured(): boolean {
  const env = getCloudflareSaaSEnv()
  return Boolean(env.zoneId && env.apiToken)
}

export function getCloudflareCnameTarget(): string {
  return getCloudflareSaaSEnv().cnameTarget
}

interface RawCloudflareCustomHostname {
  id?: string
  hostname?: string
  status?: string
  verification_errors?: string[]
  ownership_verification?: {
    type?: string
    name?: string
    value?: string
  }
  ssl?: {
    status?: string
    validation_errors?: Array<{ message?: string }>
    validation_records?: Array<{
      status?: string
      txt_name?: string
      txt_value?: string
      http_url?: string
      http_body?: string
    }>
  }
}

export function normalizeCloudflareHostnameStatus(
  hostname: string,
  raw?: RawCloudflareCustomHostname | null,
  cnameTarget = getCloudflareCnameTarget(),
  error?: string,
): NormalizedCustomHostnameStatus {
  const sslErrors = (raw?.ssl?.validation_errors || [])
    .map((e) => e?.message)
    .filter((m): m is string => Boolean(m))
  const verificationErrors = [
    ...(Array.isArray(raw?.verification_errors) ? raw.verification_errors : []),
    ...sslErrors,
  ]

  return {
    hostname,
    ...(raw?.id ? { cloudflareId: raw.id } : {}),
    status: raw?.status || (isCloudflareSaaSConfigured() ? 'unprovisioned' : 'dns_manual'),
    sslStatus:
      raw?.ssl?.status || (isCloudflareSaaSConfigured() ? 'unprovisioned' : 'dns_manual'),
    cnameTarget,
    ...(raw?.ownership_verification?.name
      ? { ownershipVerification: raw.ownership_verification }
      : {}),
    ...(Array.isArray(raw?.ssl?.validation_records) && raw.ssl.validation_records.length > 0
      ? {
          sslValidationRecords: raw.ssl.validation_records.map((r) => ({
            status: r.status,
            txtName: r.txt_name,
            txtValue: r.txt_value,
            httpUrl: r.http_url,
            httpBody: r.http_body,
          })),
        }
      : {}),
    ...(verificationErrors.length > 0 ? { verificationErrors } : {}),
    lastCheckedAt: new Date().toISOString(),
    ...(error ? { error } : {}),
  }
}

async function cfFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; result?: T; errors?: Array<{ message?: string }> }> {
  const env = getCloudflareSaaSEnv()
  if (!env.zoneId || !env.apiToken) {
    return {
      ok: false,
      status: 503,
      errors: [{ message: 'Cloudflare for SaaS is not configured yet.' }],
    }
  }

  const res = await fetch(`${CF_API_BASE}/zones/${encodeURIComponent(env.zoneId)}${path}`, {
    method: init.method || 'GET',
    headers: {
      Authorization: `Bearer ${env.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(12_000),
  })

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean
    result?: T
    errors?: Array<{ message?: string }>
  }

  return {
    ok: res.ok && json.success !== false,
    status: res.status,
    result: json.result,
    errors: json.errors,
  }
}

export async function provisionCustomHostname(
  hostname: string,
  metadata?: Record<string, string>,
): Promise<NormalizedCustomHostnameStatus> {
  const cnameTarget = getCloudflareCnameTarget()
  if (!isCloudflareSaaSConfigured()) {
    return normalizeCloudflareHostnameStatus(hostname, null, cnameTarget)
  }

  const res = await cfFetch<RawCloudflareCustomHostname>('/custom_hostnames', {
    method: 'POST',
    body: {
      hostname,
      ssl: {
        method: 'http',
        type: 'dv',
        wildcard: false,
        bundle_method: 'ubiquitous',
      },
      ...(metadata ? { custom_metadata: metadata } : {}),
    },
  })

  if (!res.ok) {
    // 409 / duplicate hostname -> look up existing record
    const existing = await getCustomHostnameByName(hostname)
    if (existing.cloudflareId) return existing
    const errMsg = res.errors?.[0]?.message || `Cloudflare HTTP ${res.status}`
    return normalizeCloudflareHostnameStatus(hostname, null, cnameTarget, errMsg)
  }

  return normalizeCloudflareHostnameStatus(hostname, res.result, cnameTarget)
}

export async function getCustomHostnameByName(
  hostname: string,
): Promise<NormalizedCustomHostnameStatus> {
  const cnameTarget = getCloudflareCnameTarget()
  if (!isCloudflareSaaSConfigured()) {
    return normalizeCloudflareHostnameStatus(hostname, null, cnameTarget)
  }

  const res = await cfFetch<RawCloudflareCustomHostname[]>(
    `/custom_hostnames?hostname=${encodeURIComponent(hostname)}`,
  )
  if (!res.ok) {
    const errMsg = res.errors?.[0]?.message || `Cloudflare HTTP ${res.status}`
    return normalizeCloudflareHostnameStatus(hostname, null, cnameTarget, errMsg)
  }

  const first = Array.isArray(res.result) ? res.result[0] : undefined
  return normalizeCloudflareHostnameStatus(hostname, first || null, cnameTarget)
}

export async function deleteCustomHostnameByName(
  hostname: string,
): Promise<{ ok: boolean; deleted: boolean; error?: string }> {
  if (!isCloudflareSaaSConfigured()) {
    return { ok: true, deleted: false }
  }

  const lookup = await getCustomHostnameByName(hostname)
  if (!lookup.cloudflareId) {
    return { ok: true, deleted: false }
  }

  const res = await cfFetch(`/custom_hostnames/${encodeURIComponent(lookup.cloudflareId)}`, {
    method: 'DELETE',
  })
  return {
    ok: res.ok,
    deleted: res.ok,
    ...(res.errors?.[0]?.message ? { error: res.errors[0].message } : {}),
  }
}

export async function saveCachedHostnameStatus(
  payload: Payload,
  tenantId: number | string,
  status: NormalizedCustomHostnameStatus,
): Promise<void> {
  try {
    await setJsonSetting(
      payload,
      {
        entityName: ENTITY_CUSTOM_HOSTNAMES,
        entityId: status.hostname.toLowerCase(),
        tenantId: Number(tenantId),
      },
      SETTING_STATUS,
      status,
      { isPrivate: false },
    )
  } catch {
    /* non-fatal cache write */
  }
}

export async function getCachedHostnameStatus(
  payload: Payload,
  tenantId: number | string,
  hostname: string,
): Promise<NormalizedCustomHostnameStatus | null> {
  try {
    const cached = await getJsonSetting<NormalizedCustomHostnameStatus>(
      payload,
      {
        entityName: ENTITY_CUSTOM_HOSTNAMES,
        entityId: hostname.toLowerCase(),
        tenantId: Number(tenantId),
      },
      SETTING_STATUS,
    )
    return cached && typeof cached === 'object' ? cached : null
  } catch {
    return null
  }
}
