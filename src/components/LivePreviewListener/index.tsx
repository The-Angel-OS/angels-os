'use client'
import { RefreshRouteOnSave as PayloadLivePreview } from '@payloadcms/live-preview-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

export const LivePreviewListener: React.FC = () => {
  const router = useRouter()
  const [serverURL, setServerURL] = useState('http://localhost:3000')
  useEffect(() => {
    setServerURL(
      process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin,
    )
  }, [])
  return (
    <PayloadLivePreview
      refresh={router.refresh}
      serverURL={serverURL}
    />
  )
}
