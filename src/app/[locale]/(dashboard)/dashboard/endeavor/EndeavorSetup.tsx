'use client'

import React, { useCallback, useEffect, useState, useTransition } from 'react'
import { getEndeavor, updateEndeavor, type EndeavorData } from './actions'
import { MediaPicker } from './MediaPicker'
// Endeavor-type options are canonical in spaceProvisioning.ts (with the union) — 53.
import { ENDEAVOR_TYPE_OPTIONS as ENDEAVOR_TYPES } from '@/utilities/spaceProvisioning'

const HOLON_OPTIONS = [
  { label: 'Manufacturer', value: 'manufacturer' },
  { label: 'Retailer', value: 'retailer' },
  { label: 'Creator', value: 'creator' },
  { label: 'Community', value: 'community' },
  { label: 'Guardian Angel', value: 'guardian-angel' },
]

export default function EndeavorSetup() {
  const [endeavor, setEndeavor] = useState<EndeavorData | null>(null)
  const [tenantId, setTenantId] = useState<string | number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadEndeavor()
  }, [])

  async function loadEndeavor() {
    setLoading(true)
    const result = await getEndeavor()
    if (result.tenantId != null) setTenantId(result.tenantId)
    if (result.success && result.endeavor) {
      setEndeavor(result.endeavor)
    } else if (result.success && !result.endeavor) {
      // No endeavor yet — start with defaults
      setEndeavor({
        name: '',
        tagline: '',
        description: '',
        endeavorType: 'custom',
        holonTypes: [],
        missionStatement: '',
        coverImage: null,
        logo: null,
        capabilities: [],
        region: { city: '', state: '', country: 'US' },
        federation: {
          networkVisible: false,
          ministryStatus: 'applicant',
          federationId: '',
          constitutionVersion: '1.1',
        },
        status: 'forming',
        operator: { name: '', email: '', role: '' },
      })
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to load Endeavor' })
    }
    setLoading(false)
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!endeavor) return
    setSaving(true)
    setMessage(null)
    const result = await updateEndeavor(endeavor)
    if (result.success) {
      setMessage({ type: 'success', text: 'Endeavor saved successfully' })
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to save' })
    }
    setSaving(false)
  }

  // ── Field updaters ─────────────────────────────────────────────────────────

  const updateField = useCallback(
    <K extends keyof EndeavorData>(field: K, value: EndeavorData[K]) => {
      setEndeavor((prev) => (prev ? { ...prev, [field]: value } : prev))
    },
    [],
  )

  const updateRegion = useCallback((field: string, value: string) => {
    setEndeavor((prev) =>
      prev ? { ...prev, region: { ...prev.region, [field]: value } } : prev,
    )
  }, [])

  const updateOperator = useCallback((field: string, value: string) => {
    setEndeavor((prev) =>
      prev ? { ...prev, operator: { ...prev.operator, [field]: value } } : prev,
    )
  }, [])

  // ── Capabilities ───────────────────────────────────────────────────────────

  function addCapability() {
    setEndeavor((prev) =>
      prev ? { ...prev, capabilities: [...prev.capabilities, { skill: '', description: '' }] } : prev,
    )
  }

  function updateCapability(index: number, field: 'skill' | 'description', value: string) {
    setEndeavor((prev) => {
      if (!prev) return prev
      const caps = [...prev.capabilities]
      caps[index] = { ...caps[index], [field]: value }
      return { ...prev, capabilities: caps }
    })
  }

  function removeCapability(index: number) {
    setEndeavor((prev) => {
      if (!prev) return prev
      return { ...prev, capabilities: prev.capabilities.filter((_, i) => i !== index) }
    })
  }

  // ── Holon toggle ───────────────────────────────────────────────────────────

  function toggleHolon(value: string) {
    setEndeavor((prev) => {
      if (!prev) return prev
      const current = prev.holonTypes || []
      const next = current.includes(value)
        ? current.filter((h) => h !== value)
        : [...current, value]
      return { ...prev, holonTypes: next }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 p-1">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (!endeavor) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Unable to load Endeavor data.
      </div>
    )
  }

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Endeavor Setup</h1>
          <p className="text-sm text-muted-foreground">
            Define your Endeavor&apos;s constitutional identity — mission, capabilities, and
            federation presence
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Federation Status Bar */}
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <span className="font-medium">Status:</span>
        <span className="rounded bg-muted px-2 py-0.5 capitalize">{endeavor.status}</span>
        {endeavor.federation.federationId && (
          <>
            <span className="text-muted-foreground">|</span>
            <span className="font-medium">Federation:</span>
            <span className="rounded bg-muted px-2 py-0.5 capitalize">
              {endeavor.federation.ministryStatus}
            </span>
          </>
        )}
      </div>

      {/* Identity Section */}
      <Section title="Identity">
        <FormField label="Endeavor Name" required>
          <input
            type="text"
            value={endeavor.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g., Clearwater Cruisin' Ministries"
            className="input-field"
          />
        </FormField>
        <FormField label="Tagline">
          <input
            type="text"
            value={endeavor.tagline}
            onChange={(e) => updateField('tagline', e.target.value)}
            placeholder="One-sentence mission statement"
            className="input-field"
          />
        </FormField>
        <FormField label="Description">
          <textarea
            value={endeavor.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={3}
            placeholder="What does this Endeavor do and stand for?"
            className="input-field"
          />
        </FormField>
        <FormField label="Endeavor Type" required>
          <select
            value={endeavor.endeavorType}
            onChange={(e) => updateField('endeavorType', e.target.value)}
            className="input-field"
          >
            {ENDEAVOR_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Mission Statement">
          <textarea
            value={endeavor.missionStatement}
            onChange={(e) => updateField('missionStatement', e.target.value)}
            rows={2}
            placeholder="What does this Endeavor serve?"
            className="input-field"
          />
        </FormField>
      </Section>

      {/* Directory listing — the card other sites show when they link to you. */}
      <Section title="Your directory listing">
        <p className="mb-4 text-sm text-muted-foreground">
          <strong>How your business looks when another site lists it</strong> — a card with a
          wide picture and a small logo on it, like a search result. Set both here; if you
          leave them empty your card shows no picture at all.
          <br />
          These are separate from the logo and cover on your own website, which live in
          Settings &rarr; General.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <ImageField
            label="Listing picture (wide)"
            value={endeavor.coverImage ?? null}
            onChange={(v) => updateField('coverImage', v)}
            aspect="banner"
            tenantId={tenantId}
          />
          <ImageField
            label="Listing logo (small, square)"
            value={endeavor.logo ?? null}
            onChange={(v) => updateField('logo', v)}
            aspect="square"
            tenantId={tenantId}
          />
        </div>
      </Section>

      {/* Operator Section */}
      <Section title="Operator">
        <div className="grid gap-4 md:grid-cols-3">
          <FormField label="Name">
            <input
              type="text"
              value={endeavor.operator.name}
              onChange={(e) => updateOperator('name', e.target.value)}
              placeholder="Full name"
              className="input-field"
            />
          </FormField>
          <FormField label="Email">
            <input
              type="email"
              value={endeavor.operator.email}
              onChange={(e) => updateOperator('email', e.target.value)}
              placeholder="Email address"
              className="input-field"
            />
          </FormField>
          <FormField label="Role">
            <input
              type="text"
              value={endeavor.operator.role}
              onChange={(e) => updateOperator('role', e.target.value)}
              placeholder="e.g., Founder, Chapter Lead"
              className="input-field"
            />
          </FormField>
        </div>
      </Section>

      {/* Holon Types */}
      <Section title="Federation Holon Types">
        <p className="mb-3 text-sm text-muted-foreground">
          Select the roles this Endeavor plays in the federation network.
        </p>
        <div className="flex flex-wrap gap-2">
          {HOLON_OPTIONS.map((h) => (
            <button
              key={h.value}
              onClick={() => toggleHolon(h.value)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                endeavor.holonTypes.includes(h.value)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Capabilities */}
      <Section title="Capabilities">
        <p className="mb-3 text-sm text-muted-foreground">
          What can this Endeavor offer to the federation network?
        </p>
        {endeavor.capabilities.map((cap, i) => (
          <div key={i} className="mb-3 flex items-start gap-2">
            <div className="flex-1 grid gap-2 md:grid-cols-2">
              <input
                type="text"
                value={cap.skill}
                onChange={(e) => updateCapability(i, 'skill', e.target.value)}
                placeholder="Skill or offering"
                className="input-field"
              />
              <input
                type="text"
                value={cap.description}
                onChange={(e) => updateCapability(i, 'description', e.target.value)}
                placeholder="Brief description"
                className="input-field"
              />
            </div>
            <button
              onClick={() => removeCapability(i)}
              className="mt-1 rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
              title="Remove"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={addCapability}
          className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
        >
          + Add capability
        </button>
      </Section>

      {/* Region */}
      <Section title="Region">
        <div className="grid gap-4 md:grid-cols-3">
          <FormField label="City">
            <input
              type="text"
              value={endeavor.region.city}
              onChange={(e) => updateRegion('city', e.target.value)}
              placeholder="City"
              className="input-field"
            />
          </FormField>
          <FormField label="State">
            <input
              type="text"
              value={endeavor.region.state}
              onChange={(e) => updateRegion('state', e.target.value)}
              placeholder="State"
              className="input-field"
            />
          </FormField>
          <FormField label="Country">
            <input
              type="text"
              value={endeavor.region.country}
              onChange={(e) => updateRegion('country', e.target.value)}
              placeholder="US"
              className="input-field"
            />
          </FormField>
        </div>
      </Section>

      {/* Federation Visibility */}
      <Section title="Discovery & Federation">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={endeavor.federation.networkVisible}
            onChange={(e) =>
              setEndeavor((prev) =>
                prev
                  ? {
                      ...prev,
                      federation: { ...prev.federation, networkVisible: e.target.checked },
                    }
                  : prev,
              )
            }
            className="h-4 w-4 rounded border-gray-300"
          />
          <div>
            <span className="text-sm font-medium">Show in Discovery</span>
            <p className="text-xs text-muted-foreground">
              Adds the <strong>Discovery</strong> link to your site header and lists this
              Endeavor in the Angel OS network catalog so others can find you.
            </p>
          </div>
        </label>
        {endeavor.federation.federationId && (
          <div className="mt-3 text-xs text-muted-foreground">
            Federation ID: <code className="bg-muted px-1 rounded">{endeavor.federation.federationId}</code>
          </div>
        )}
      </Section>

      {/* Inline styles for form fields */}
      <style jsx global>{`
        .input-field {
          display: block;
          width: 100%;
          rounded: 0.375rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          line-height: 1.25rem;
          border-radius: 0.375rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-field:focus {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 1px hsl(var(--primary) / 0.3);
        }
        .input-field::placeholder {
          color: hsl(var(--muted-foreground));
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </div>
  )
}

export type MediaValue = { id: number | string; url: string } | null

/**
 * Image picker for a media field: shows the current image, uploads a new
 * one to /api/media (tenant-scoped by the x-tenant-id middleware), and clears it.
 * The selected media id is saved when the user clicks Save Changes.
 * Also reused by Settings → General for the SITE logo (tenant.branding.logo) —
 * distinct from the Discovery Card badge (endeavor.logo) here.
 */
export function ImageField({
  label,
  value,
  onChange,
  aspect,
  tenantId,
}: {
  label: string
  value: MediaValue
  onChange: (v: MediaValue) => void
  aspect: 'banner' | 'square'
  tenantId?: string | number | null
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      // Media.alt is required — derive it from the filename so the upload
      // validates (Payload reads non-file fields from the _payload part).
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || label
      fd.append('_payload', JSON.stringify({ alt }))
      const res = await fetch('/api/media', { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.errors?.[0]?.message || 'Upload failed')
      const doc = data.doc || data
      if (!doc?.id) throw new Error('Upload returned no media')
      onChange({ id: doc.id, url: doc.url || '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <div
        className={`relative overflow-hidden rounded-md border border-border bg-muted/30 ${
          aspect === 'banner' ? 'aspect-[16/9]' : 'aspect-square max-w-[160px]'
        }`}
      >
        {value?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
          e.target.value = ''
        }}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
        </button>
        <button
          type="button"
          onClick={() => setPicking(true)}
          disabled={uploading}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary disabled:opacity-50"
        >
          Choose existing
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={uploading}
            className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-red-600 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <p className="mt-1 text-[11px] text-muted-foreground">Changes apply when you click Save.</p>
      {picking && (
        <MediaPicker
          onSelect={(m) => { onChange({ id: m.id, url: m.url }); setPicking(false) }}
          onClose={() => setPicking(false)}
          tenantId={tenantId}
        />
      )}
    </div>
  )
}

function FormField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
