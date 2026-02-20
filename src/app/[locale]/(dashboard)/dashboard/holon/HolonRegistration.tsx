'use client'

import React, { useState } from 'react'

/**
 * HolonRegistration — Client component for Holon node registration.
 *
 * Lets tenants register as production nodes in the constitutional
 * manufacturing network. Supports all 6 node types.
 */

const NODE_TYPES = [
  { value: 'assembly', label: 'Assembly Node', icon: '🔧', desc: '3D printing, CNC, laser cutting' },
  { value: 'print', label: 'Print Node', icon: '👕', desc: 'T-shirts, mugs, posters, stickers' },
  { value: 'service', label: 'Service Node', icon: '💆', desc: 'Massage, cleaning, consulting' },
  { value: 'product', label: 'Product Node', icon: '🌵', desc: 'Physical goods, plants, food' },
  { value: 'digital', label: 'Digital Node', icon: '💻', desc: 'Design, code, content, music' },
  { value: 'fulfillment', label: 'Fulfillment Node', icon: '📦', desc: 'Storage, packaging, shipping' },
] as const

interface Capability {
  skill: string
  equipment: string
  materials: string
  maxVolume: string
  turnaroundHours: string
}

interface ExistingRegistration {
  id: number
  nodeType: string
  businessName?: string
  contactName?: string
  capabilities: Array<{
    skill?: string
    equipment?: string
    materials?: string[] | null
    maxVolume?: string
    turnaroundHours?: number
  }>
  serviceRadius?: number
  location?: { lat?: number; lng?: number; city?: string; region?: string }
  rating?: number
  constitutionalCompliance?: boolean
}

interface HolonRegistrationProps {
  tenantId?: number
  existingRegistration?: ExistingRegistration | null
}

export function HolonRegistration({ tenantId, existingRegistration }: HolonRegistrationProps) {
  const [selectedType, setSelectedType] = useState<string>(
    existingRegistration?.nodeType || '',
  )
  const [businessName, setBusinessName] = useState(
    existingRegistration?.businessName || '',
  )
  const [contactName, setContactName] = useState(
    existingRegistration?.contactName || '',
  )
  const [capabilities, setCapabilities] = useState<Capability[]>(
    existingRegistration?.capabilities?.map((c) => ({
      skill: c.skill || '',
      equipment: c.equipment || '',
      materials: Array.isArray(c.materials) ? c.materials.join(', ') : '',
      maxVolume: c.maxVolume || '',
      turnaroundHours: c.turnaroundHours?.toString() || '',
    })) || [{ skill: '', equipment: '', materials: '', maxVolume: '', turnaroundHours: '' }],
  )
  const [serviceRadius, setServiceRadius] = useState(
    existingRegistration?.serviceRadius?.toString() || '',
  )
  const [city, setCity] = useState(existingRegistration?.location?.city || '')
  const [region, setRegion] = useState(existingRegistration?.location?.region || '')
  const [compliance, setCompliance] = useState(
    existingRegistration?.constitutionalCompliance ?? false,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const addCapability = () => {
    setCapabilities([
      ...capabilities,
      { skill: '', equipment: '', materials: '', maxVolume: '', turnaroundHours: '' },
    ])
  }

  const removeCapability = (index: number) => {
    if (capabilities.length <= 1) return
    setCapabilities(capabilities.filter((_, i) => i !== index))
  }

  const updateCapability = (index: number, field: keyof Capability, value: string) => {
    const updated = [...capabilities]
    updated[index] = { ...updated[index], [field]: value }
    setCapabilities(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !selectedType || !compliance) return

    setIsSubmitting(true)
    setMessage(null)

    try {
      const capsData = capabilities
        .filter((c) => c.skill.trim())
        .map((c) => ({
          skill: c.skill.trim(),
          equipment: c.equipment.trim() || undefined,
          materials: c.materials
            ? c.materials.split(',').map((m) => m.trim()).filter(Boolean)
            : undefined,
          maxVolume: c.maxVolume.trim() || undefined,
          turnaroundHours: c.turnaroundHours ? Number(c.turnaroundHours) : undefined,
        }))

      if (capsData.length === 0) {
        setMessage({ type: 'error', text: 'At least one capability with a skill name is required.' })
        setIsSubmitting(false)
        return
      }

      const data = {
        tenant: tenantId,
        nodeType: selectedType,
        businessName: businessName.trim() || undefined,
        contactName: contactName.trim() || undefined,
        capabilities: capsData,
        serviceRadius: serviceRadius ? Number(serviceRadius) : undefined,
        location: {
          city: city.trim() || undefined,
          region: region.trim() || undefined,
        },
        constitutionalCompliance: true,
      }

      const url = existingRegistration
        ? `/api/holon-capabilities/${existingRegistration.id}`
        : '/api/holon-capabilities'
      const method = existingRegistration ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        setMessage({
          type: 'success',
          text: existingRegistration
            ? 'Holon registration updated!'
            : 'Registered as a Holon node! Welcome to the network. Ask LEO: "Find me orders" to start receiving work.',
        })
      } else {
        const err = await res.json().catch(() => ({}))
        setMessage({ type: 'error', text: err.message || 'Registration failed.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          {existingRegistration ? 'Update Your Holon Node' : 'Register as a Holon Node'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Join the constitutional manufacturing network. Declare what you can produce,
          and the network will match you with orders within your service radius.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Node Type Selection */}
        <div>
          <label className="mb-3 block text-sm font-semibold">What type of node are you?</label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {NODE_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setSelectedType(type.value)}
                className={`rounded-lg border p-4 text-left transition-all ${
                  selectedType === type.value
                    ? 'border-primary bg-primary/5 ring-2 ring-primary'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <span className="text-2xl">{type.icon}</span>
                <p className="mt-1 text-sm font-medium">{type.label}</p>
                <p className="text-xs text-muted-foreground">{type.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Business Info */}
        {selectedType && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold">Business Name</label>
              <input
                type="text"
                placeholder="e.g., HIT Promotional Products"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">How your business appears on the network</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Contact Name</label>
              <input
                type="text"
                placeholder="e.g., John Smith"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">Primary contact for order coordination</p>
            </div>
          </div>
        )}

        {/* Capabilities */}
        {selectedType && (
          <div>
            <label className="mb-3 block text-sm font-semibold">Capabilities</label>
            <div className="space-y-4">
              {capabilities.map((cap, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/20 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Capability #{i + 1}
                    </span>
                    {capabilities.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCapability(i)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Skill (e.g., 3d-printing) *"
                      value={cap.skill}
                      onChange={(e) => updateCapability(i, 'skill', e.target.value)}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Equipment (e.g., Bambu Lab X1C)"
                      value={cap.equipment}
                      onChange={(e) => updateCapability(i, 'equipment', e.target.value)}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Materials (comma-separated: PLA, PETG)"
                      value={cap.materials}
                      onChange={(e) => updateCapability(i, 'materials', e.target.value)}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Max volume (e.g., 250x250x250mm)"
                      value={cap.maxVolume}
                      onChange={(e) => updateCapability(i, 'maxVolume', e.target.value)}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Turnaround (hours)"
                      value={cap.turnaroundHours}
                      onChange={(e) => updateCapability(i, 'turnaroundHours', e.target.value)}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                      min="1"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addCapability}
                className="rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
              >
                + Add Capability
              </button>
            </div>
          </div>
        )}

        {/* Location & Radius */}
        {selectedType && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">City</label>
              <input
                type="text"
                placeholder="e.g., Clearwater"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">State/Region</label>
              <input
                type="text"
                placeholder="e.g., FL"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Service Radius (miles)</label>
              <input
                type="number"
                placeholder={selectedType === 'digital' ? '0 (no limit)' : '100'}
                value={serviceRadius}
                onChange={(e) => setServiceRadius(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                min="0"
              />
            </div>
          </div>
        )}

        {/* Constitutional Compliance */}
        {selectedType && (
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={compliance}
                onChange={(e) => setCompliance(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border"
                required
              />
              <div>
                <p className="text-sm font-medium">Constitutional Compliance</p>
                <p className="text-xs text-muted-foreground">
                  I agree to operate under the Angel OS constitution: 60/20/15/5 Ultimate Fair Split,
                  Answer 53 principles, and network governance. The constitution is the reputation system.
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Submit */}
        {selectedType && (
          <div>
            {message && (
              <div
                className={`mb-4 rounded-lg p-3 text-sm ${
                  message.type === 'success'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}
              >
                {message.text}
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting || !compliance}
              className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting
                ? 'Registering...'
                : existingRegistration
                  ? 'Update Registration'
                  : 'Register as Holon Node'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
