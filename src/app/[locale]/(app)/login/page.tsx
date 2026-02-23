import type { Metadata } from 'next'

import { RenderParams } from '@/components/RenderParams'
import Link from 'next/link'
import React from 'react'

import { headers as getHeaders } from 'next/headers'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { LoginForm } from '@/components/forms/LoginForm'
import { redirect } from 'next/navigation'

export default async function Login() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (user) {
    // Route already-logged-in users by role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roles: string[] = Array.isArray((user as any)?.roles) ? (user as any).roles : []
    const isAdmin = roles.some((r) => ['super_admin', 'admin', 'archangel'].includes(r))
    redirect(isAdmin ? '/admin' : '/dashboard')
  }

  return (
    <div className="container">
      <div className="max-w-xl mx-auto my-12">
        <RenderParams />

        <h1 className="mb-4 text-[1.8rem]">Log in</h1>
        <p className="mb-8">
          {`Welcome back. Log in to manage your account, review orders, and more.`}
        </p>
        <LoginForm />
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Login or create an account to get started.',
  openGraph: {
    title: 'Login',
    url: '/login',
  },
  title: 'Login',
}
