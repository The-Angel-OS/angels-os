'use client'
import { RefreshRouteOnSave as PayloadLivePreview } from '@payloadcms/live-preview-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

export const LivePreviewListener: React.FC = () => {
  const router = useRouter()
  const [serverURL, setServerURL] = useState('')
  useEffect(() => {
    // Use current origin to avoid postMessage cross-origin mismatch.
    // NEXT_PUBLIC_SERVER_URL may be undefined on Vercel if not set as env var.
    setServerURL(
      process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin,
    )
  }, [])

  // Don't render until we have a valid URL — empty string crashes postMessage
  if (!serverURL) return null

  return (
    <PayloadLivePreview
      refresh={router.refresh}
      serverURL={serverURL}
    />
  )
}
