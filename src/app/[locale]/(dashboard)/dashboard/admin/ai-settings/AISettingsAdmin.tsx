'use client'

import React, { useState } from 'react'

/**
 * AISettingsAdmin — Bring-Your-Own-AI-Key management.
 *
 * Allows tenants to use their own API keys for LEO (Anthropic)
 * and image generation (OpenRouter), reducing platform costs.
 */

interface AISettingsAdminProps {
  tenantId: number
  hasAnthropicKey: boolean
  hasOpenRouterKey: boolean
}

export function AISettingsAdmin({
  tenantId,
  hasAnthropicKey,
  hasOpenRouterKey,
}: AISettingsAdminProps) {
  const [anthropicKey, setAnthropicKey] = useState('')
  const [openRouterKey, setOpenRouterKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSave = async (keyType: 'anthropic' | 'openrouter') => {
    setSaving(true)
    setMessage(null)

    const key = keyType === 'anthropic' ? anthropicKey : openRouterKey
    if (!key.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid API key.' })
      setSaving(false)
      return
    }

    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiConfig: {
            ...(keyType === 'anthropic'
              ? { anthropicApiKey: key }
              : { openrouterApiKey: key }),
          },
        }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: `${keyType === 'anthropic' ? 'Anthropic' : 'OpenRouter'} key saved successfully.` })
        if (keyType === 'anthropic') setAnthropicKey('')
        else setOpenRouterKey('')
      } else {
        setMessage({ type: 'error', text: 'Failed to save key. Check your permissions.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">AI Settings</h1>
        <p className="text-muted-foreground mt-1">
          Bring your own API keys for LEO and image generation. When set, your keys are used
          instead of platform keys — giving you full control over costs and usage limits.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-4 ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950'
              : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
          }`}
        >
          <p
            className={`text-sm ${
              message.type === 'success'
                ? 'text-emerald-800 dark:text-emerald-200'
                : 'text-red-800 dark:text-red-200'
            }`}
          >
            {message.text}
          </p>
        </div>
      )}

      {/* Anthropic (LEO) */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Anthropic API Key</h2>
            <p className="text-sm text-muted-foreground">
              Used for LEO conversations (Claude). When set, LEO uses your key instead of the
              platform key.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              hasAnthropicKey
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${hasAnthropicKey ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
            />
            {hasAnthropicKey ? 'Active' : 'Using platform key'}
          </span>
        </div>

        <div className="flex gap-3">
          <input
            type="password"
            placeholder={hasAnthropicKey ? '••••••••••••••••' : 'sk-ant-...'}
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={() => handleSave('anthropic')}
            disabled={saving || !anthropicKey.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* OpenRouter (Image Generation) */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">OpenRouter API Key</h2>
            <p className="text-sm text-muted-foreground">
              Used for image generation (Flux, Gemini). When set, image generation uses your key.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              hasOpenRouterKey
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${hasOpenRouterKey ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
            />
            {hasOpenRouterKey ? 'Active' : 'Using platform key'}
          </span>
        </div>

        <div className="flex gap-3">
          <input
            type="password"
            placeholder={hasOpenRouterKey ? '••••••••••••••••' : 'sk-or-...'}
            value={openRouterKey}
            onChange={(e) => setOpenRouterKey(e.target.value)}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={() => handleSave('openrouter')}
            disabled={saving || !openRouterKey.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h3 className="text-sm font-medium mb-2">How it works</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Keys are encrypted at rest and never exposed in the dashboard after saving</li>
          <li>LEO checks your tenant config first, then falls back to the platform key</li>
          <li>You can remove a key at any time to switch back to platform-provided AI</li>
          <li>Usage on your own keys is billed directly by the provider (Anthropic / OpenRouter)</li>
        </ul>
      </div>
    </div>
  )
}
