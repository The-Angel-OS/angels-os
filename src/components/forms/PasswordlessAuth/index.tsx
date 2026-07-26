'use client'

import React, { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Passwordless auth — enter an email or mobile number, get a 6-digit code.
 *
 * WITH A CODE, SIGNING UP AND SIGNING IN ARE THE SAME ACT. verifyOtp
 * find-or-creates the user (and returns isNew), so this component serves the
 * login page and the create-account page from one implementation — the caller
 * only changes the wording. That is why "create an account" here asks for no
 * password and no second visit to a confirmation link: whether the account
 * already exists is the server's problem, not the visitor's.
 *
 * Accepts an email OR a phone number in the same box on purpose. Making someone
 * pick "sign in with email" vs "sign in with phone" before they have typed
 * anything is a choice they cannot make wrongly, so it should not be a choice.
 */
export const PasswordlessAuth: React.FC<{
  /** Where to land after success. Defaults to the dashboard. */
  redirectTo?: string | null
  /** Verb shown on the button — "Send code" reads oddly under "Get started". */
  submitLabel?: string
  onCancel?: () => void
  cancelLabel?: string
}> = ({ redirectTo, submitLabel = 'Send me a code', onCancel, cancelLabel = 'Use a password instead' }) => {
  const [stage, setStage] = useState<'request' | 'verify'>('request')
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isEmail = identifier.includes('@')
  const payload = () => (isEmail ? { email: identifier.trim() } : { phone: identifier.trim() })

  const requestCode = useCallback(async () => {
    setError(null)
    setInfo(null)
    const id = identifier.trim()
    if (!id || (!id.includes('@') && !/^[+()0-9 .-]{7,}$/.test(id))) {
      setError('Enter your email address or mobile number.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      })
      const data = (await res.json().catch(() => ({}))) as { devCode?: string }
      if (!res.ok) throw new Error('request failed')
      setStage('verify')
      setInfo(
        data.devCode
          ? `Dev mode — your code is ${data.devCode}`
          : id.includes('@')
            ? 'A 6-digit code is on its way. Check your email.'
            : 'A 6-digit code is on its way by text.',
      )
    } catch {
      setError('Could not send a code right now — please try again in a minute.')
    } finally {
      setBusy(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier])

  const verifyCode = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload(), code: code.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as { token?: string }
      if (!res.ok || !data.token) {
        setError('That code did not work — check it and try again, or request a new one.')
        return
      }
      // Same cookie path the OAuth completion uses — HttpOnly, apex-scoped.
      await fetch('/api/auth/set-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token }),
        credentials: 'include',
      })
      // Hard navigation so server components pick up the fresh session cookie.
      window.location.assign(redirectTo || '/dashboard')
    } catch {
      setError('Sign-in failed — please try again.')
    } finally {
      setBusy(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier, code, redirectTo])

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="text"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com or mobile number"
        value={identifier}
        disabled={stage === 'verify'}
        onChange={(e) => setIdentifier(e.target.value)}
      />

      {stage === 'verify' && (
        <Input
          type="text"
          // numeric one-time-code so phone keyboards show digits and iOS can
          // autofill the texted code.
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      )}

      {info && <p className="text-xs text-muted-foreground">{info}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {stage === 'request' ? (
        <Button type="button" disabled={busy} onClick={requestCode}>
          {busy ? 'Sending…' : submitLabel}
        </Button>
      ) : (
        <>
          <Button type="button" disabled={busy || code.length < 6} onClick={verifyCode}>
            {busy ? 'Checking…' : 'Continue'}
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => {
              setStage('request')
              setCode('')
              setInfo(null)
            }}
          >
            Use a different address
          </button>
        </>
      )}

      {onCancel && (
        <button type="button" className="text-xs text-muted-foreground underline" onClick={onCancel}>
          {cancelLabel}
        </button>
      )}
    </div>
  )
}
