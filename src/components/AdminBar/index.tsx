'use client'

import type { PayloadAdminBarProps } from '@payloadcms/admin-bar'

import { cn } from '@/utilities/cn'
import { useSelectedLayoutSegments, useParams } from 'next/navigation'
import { PayloadAdminBar } from '@payloadcms/admin-bar'
import React, { useState } from 'react'
import { User } from '@/payload-types'
import Link from 'next/link'
import { ADMIN_ROLES } from '@/access/utilities'

const collectionLabels = {
  pages: {
    plural: 'Pages',
    singular: 'Page',
  },
  posts: {
    plural: 'Posts',
    singular: 'Post',
  },
  projects: {
    plural: 'Projects',
    singular: 'Project',
  },
}

type CollectionKey = keyof typeof collectionLabels

const Title: React.FC = () => <span>Angel OS</span>

export const AdminBar: React.FC<{
  adminBarProps?: PayloadAdminBarProps
}> = (props) => {
  const { adminBarProps } = props || {}
  const segments = useSelectedLayoutSegments()
  const params = useParams()
  const locale = (params?.locale as string) || 'en'
  const [show, setShow] = useState(false)
  const segmentKey = segments?.[1] as CollectionKey | undefined
  const collection: CollectionKey = segmentKey && collectionLabels[segmentKey] ? segmentKey : 'pages'

  const onAuthChange = React.useCallback((user: unknown) => {
    const typedUser = user as User
    const canSeeAdmin =
      typedUser?.roles &&
      Array.isArray(typedUser.roles) &&
      typedUser.roles.some((r) => ADMIN_ROLES.includes(r))
    setShow(Boolean(canSeeAdmin))
  }, [])

  const cmsURL = process.env.NEXT_PUBLIC_SERVER_URL || ''

  return (
    <div
      className={cn('py-2 bg-sidebar text-sidebar-foreground', {
        block: show,
        hidden: !show,
      })}
    >
      <div className="container flex items-center justify-between gap-4">
        <PayloadAdminBar
          {...adminBarProps}
          className="py-2 text-white flex-1"
          classNames={{
            controls: 'font-medium text-white',
            logo: 'text-white',
            user: 'text-white',
          }}
          cmsURL={cmsURL}
          collectionLabels={{
            plural: collectionLabels[collection]?.plural || 'Pages',
            singular: collectionLabels[collection]?.singular || 'Page',
          }}
          logo={<Title />}
          onAuthChange={onAuthChange}
          style={{
            backgroundColor: 'transparent',
            padding: 0,
            position: 'relative',
            zIndex: 'unset',
          }}
        />

        {/* Quick navigation buttons */}
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={`/${locale}/dashboard`}
            className="rounded px-2 py-1 font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/admin"
            className="rounded px-2 py-1 font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            Admin
          </Link>
        </div>
      </div>
    </div>
  )
}
