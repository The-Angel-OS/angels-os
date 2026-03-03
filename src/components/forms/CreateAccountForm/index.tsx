'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { SocialAuthButtons } from '@/components/forms/SocialAuthButtons'
import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import { getClientSideURL } from '@/utilities/getURL'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useCallback, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  email: string
  password: string
  passwordConfirm: string
}

export const CreateAccountForm: React.FC = () => {
  const searchParams = useSearchParams()
  const allParams = searchParams.toString() ? `?${searchParams.toString()}` : ''
  const { login } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<null | string>(null)

  const {
    formState: { errors },
    handleSubmit,
    register,
    watch,
  } = useForm<FormData>()

  const password = useRef({})
  password.current = watch('password', '')

  const onSubmit = useCallback(
    async (data: FormData) => {
      setError(null)
      setLoading(true)

      try {
        const response = await fetch(`${getClientSideURL()}/api/users`, {
          body: JSON.stringify(data),
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          const message =
            body?.errors?.[0]?.message || body?.message || response.statusText || 'There was an error creating the account.'
          setError(message)
          setLoading(false)
          return
        }
      } catch {
        setError('Unable to reach the server. Please check your connection and try again.')
        setLoading(false)
        return
      }

      // Account created — now log in
      try {
        await login(data)

        // Validate redirect is same-origin (prevents open redirect)
        const redirect = searchParams.get('redirect')
        if (redirect && redirect.startsWith('/')) {
          router.push(redirect)
        } else {
          router.push('/dashboard')
        }
      } catch (_) {
        // Account was created but auto-login failed — send to login page
        setLoading(false)
        router.push(`/login?success=${encodeURIComponent('Account created! Please sign in.')}`)
      }
    },
    [login, router, searchParams],
  )

  return (
    <div>
      {/* ─── Social Auth (primary CTA — lowest friction) ─────── */}
      <SocialAuthButtons redirect={searchParams.get('redirect')} />

      {/* ─── Divider ──────────────────────────────────────────── */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or with email</span>
        </div>
      </div>

      {/* ─── Email/Password Form ──────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Message error={error} />

        <div className="flex flex-col gap-4 mb-6">
          <FormItem>
            <Label htmlFor="email" className="sr-only">
              Email Address
            </Label>
            <Input
              id="email"
              {...register('email', { required: 'Email is required.' })}
              type="email"
              placeholder="you@example.com"
              className="h-11"
            />
            {errors.email && <FormError message={errors.email.message} />}
          </FormItem>

          <FormItem>
            <Label htmlFor="password" className="sr-only">
              Password
            </Label>
            <Input
              id="password"
              {...register('password', {
                required: 'Password is required.',
                minLength: { value: 8, message: 'Password must be at least 8 characters.' },
              })}
              type="password"
              placeholder="Password (8+ characters)"
              className="h-11"
            />
            {errors.password && <FormError message={errors.password.message} />}
          </FormItem>

          <FormItem>
            <Label htmlFor="passwordConfirm" className="sr-only">
              Confirm Password
            </Label>
            <Input
              id="passwordConfirm"
              {...register('passwordConfirm', {
                required: 'Please confirm your password.',
                validate: (value) => value === password.current || 'The passwords do not match',
              })}
              type="password"
              placeholder="Confirm password"
              className="h-11"
            />
            {errors.passwordConfirm && <FormError message={errors.passwordConfirm.message} />}
          </FormItem>
        </div>

        <Button disabled={loading} type="submit" variant="default" size="lg" className="w-full h-11">
          {loading ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>

      {/* ─── Login Link ───────────────────────────────────────── */}
      <p className="text-sm text-center text-muted-foreground mt-6">
        Already have an account?{' '}
        <Link href={`/login${allParams}`} className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
