'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { SocialAuthButtons } from '@/components/forms/SocialAuthButtons'
import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  email: string
  password: string
}

/** Route by role: admins → Payload admin panel, everyone else → dashboard. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function destinationFor(user: any, redirect?: string | null): string {
  if (redirect) return redirect
  const roles: string[] = Array.isArray(user?.roles) ? user.roles : []
  const isAdmin = roles.some((r) => ['super_admin', 'admin', 'archangel'].includes(r))
  return isAdmin ? '/admin' : '/dashboard'
}

export const LoginForm: React.FC = () => {
  const searchParams = useSearchParams()
  const allParams = searchParams.toString() ? `?${searchParams.toString()}` : ''
  const redirect = useRef(searchParams.get('redirect'))
  const { login } = useAuth()
  const router = useRouter()
  const [error, setError] = React.useState<null | string>(null)

  // ── Passwordless (emailed code) mode — wires the existing /api/auth/
  //    request-otp + verify-otp endpoints, which were built but never surfaced
  //    on the web login. ─────────────────────────────────────────────────────
  const [otpMode, setOtpMode] = React.useState(false)
  const [otpStage, setOtpStage] = React.useState<'request' | 'verify'>('request')
  const [otpEmail, setOtpEmail] = React.useState('')
  const [otpCode, setOtpCode] = React.useState('')
  const [otpBusy, setOtpBusy] = React.useState(false)
  const [otpInfo, setOtpInfo] = React.useState<string | null>(null)

  const {
    formState: { errors, isLoading },
    handleSubmit,
    register,
  } = useForm<FormData>()

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        const user = await login(data)
        router.push(destinationFor(user, redirect?.current))
      } catch (_) {
        setError('There was an error with the credentials provided. Please try again.')
      }
    },
    [login, router],
  )

  const requestCode = useCallback(async () => {
    setError(null)
    setOtpInfo(null)
    if (!otpEmail.trim() || !otpEmail.includes('@')) {
      setError('Please enter your email address.')
      return
    }
    setOtpBusy(true)
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; devCode?: string }
      if (!res.ok) throw new Error('request failed')
      setOtpStage('verify')
      setOtpInfo(
        data.devCode
          ? `Dev mode — your code is ${data.devCode}`
          : 'If that address has an account, a 6-digit code is on its way. Check your email.',
      )
    } catch {
      setError('Could not send a code right now — please try again in a minute.')
    } finally {
      setOtpBusy(false)
    }
  }, [otpEmail])

  const verifyCode = useCallback(async () => {
    setError(null)
    setOtpBusy(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail.trim(), code: otpCode.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        token?: string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        user?: any
      }
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
      window.location.assign(destinationFor(data.user, redirect?.current))
    } catch {
      setError('Sign-in failed — please try again.')
    } finally {
      setOtpBusy(false)
    }
  }, [otpEmail, otpCode])

  if (otpMode) {
    return (
      <div className="font-mono">
        <Message className="classes.message" error={error} />
        {otpInfo && <p className="mb-4 text-sm text-primary/80">{otpInfo}</p>}
        <div className="flex flex-col gap-8">
          <FormItem>
            <Label htmlFor="otp-email">Email</Label>
            <Input
              id="otp-email"
              type="email"
              value={otpEmail}
              autoComplete="email"
              disabled={otpStage === 'verify'}
              onChange={(e) => setOtpEmail(e.target.value)}
            />
          </FormItem>

          {otpStage === 'verify' && (
            <FormItem>
              <Label htmlFor="otp-code">6-digit code</Label>
              <Input
                id="otp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void verifyCode()
                }}
              />
            </FormItem>
          )}

          <div className="flex gap-4 justify-between">
            <Button
              variant="outline"
              size="lg"
              type="button"
              onClick={() => {
                setOtpMode(false)
                setOtpStage('request')
                setOtpCode('')
                setError(null)
                setOtpInfo(null)
              }}
            >
              Use password instead
            </Button>
            {otpStage === 'request' ? (
              <Button className="grow" size="lg" type="button" disabled={otpBusy} onClick={() => void requestCode()}>
                {otpBusy ? 'Sending…' : 'Email me a code'}
              </Button>
            ) : (
              <Button
                className="grow"
                size="lg"
                type="button"
                disabled={otpBusy || otpCode.length !== 6}
                onClick={() => void verifyCode()}
              >
                {otpBusy ? 'Signing in…' : 'Sign in'}
              </Button>
            )}
          </div>

          {otpStage === 'verify' && (
            <p className="text-sm text-primary/70">
              Didn&apos;t get it?{' '}
              <button type="button" className="underline" onClick={() => void requestCode()} disabled={otpBusy}>
                Send a new code
              </button>
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <form className="font-mono" onSubmit={handleSubmit(onSubmit)}>
      <Message className="classes.message" error={error} />
      <div className="flex flex-col gap-8">
        <FormItem>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            {...register('email', { required: 'Email is required.' })}
          />
          {errors.email && <FormError message={errors.email.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            {...register('password', { required: 'Please provide a password.' })}
          />
          {errors.password && <FormError message={errors.password.message} />}
        </FormItem>

        <div className="text-primary/70 mb-6 prose prose-a:hover:text-primary dark:prose-invert">
          <p>
            Forgot your password?{' '}
            <Link href={`/forgot-password${allParams}`}>Click here to reset it</Link>
            <br />
            Or{' '}
            <button
              type="button"
              className="underline"
              onClick={() => {
                setOtpMode(true)
                setError(null)
              }}
            >
              email me a sign-in code
            </button>{' '}
            — no password needed.
          </p>
        </div>
      </div>

      <div className="flex gap-4 justify-between">
        <Button asChild variant="outline" size="lg">
          <Link href={`/create-account${allParams}`} className="grow max-w-[50%]">
            Create an account
          </Link>
        </Button>
        <Button className="grow" disabled={isLoading} size="lg" type="submit" variant="default">
          {isLoading ? 'Processing' : 'Continue'}
        </Button>
      </div>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" style={{ borderColor: 'rgba(245, 166, 35, 0.2)' }} />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <SocialAuthButtons redirect={redirect?.current} />
    </form>
  )
}
