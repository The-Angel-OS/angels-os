'use client'

import React, { Fragment, useCallback, useState, MouseEvent } from 'react'
import { toast } from '@payloadcms/ui'

import './index.scss'

const SuccessMessage: React.FC = () => (
  <div>
    Database seeded! You can now{' '}
    <a target="_blank" href="/">
      visit your website
    </a>
  </div>
)

/**
 * SeedButton — improved with error recovery.
 * After an error, the user can retry without refreshing the page.
 * Shows progress timing so the user knows it's working.
 */
export const SeedButton: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = useCallback(
    async (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()

      if (seeded) {
        toast.info('Database already seeded.')
        return
      }
      if (loading) {
        toast.info('Seeding already in progress — this can take up to 2 minutes.')
        return
      }

      // Clear any previous error so user can retry
      setError(null)
      setLoading(true)

      try {
        toast.promise(
          new Promise((resolve, reject) => {
            try {
              fetch('/next/seed', {
                method: 'POST',
                credentials: 'include',
                // Long timeout — seed can take 60-120s with remote image fetches
                signal: AbortSignal.timeout(300000),
              })
                .then(async (res) => {
                  if (res.ok) {
                    resolve(true)
                    setSeeded(true)
                  } else {
                    // Try to get error details from response
                    let errorMsg = 'An error occurred while seeding.'
                    try {
                      const data = await res.json()
                      if (data.error) errorMsg = `Seed failed: ${data.error}`
                    } catch {
                      // Response wasn't JSON
                    }
                    reject(errorMsg)
                    setError(errorMsg)
                    setLoading(false) // Allow retry
                  }
                })
                .catch((fetchError) => {
                  const msg =
                    fetchError?.name === 'TimeoutError'
                      ? 'Seed timed out — the server may still be processing. Try refreshing in a minute.'
                      : `Network error: ${fetchError?.message || 'Unknown'}`
                  reject(msg)
                  setError(msg)
                  setLoading(false) // Allow retry
                })
            } catch (error) {
              reject(error)
              setError(String(error))
              setLoading(false) // Allow retry
            }
          }),
          {
            loading: 'Seeding with data — this may take 1-2 minutes...',
            success: <SuccessMessage />,
            error: (err: unknown) => String(err) || 'An error occurred while seeding.',
          },
        )
      } catch (err) {
        setError(String(err))
        setLoading(false) // Allow retry
      }
    },
    [loading, seeded],
  )

  let message = ''
  if (loading) message = ' (seeding — please wait...)'
  if (seeded) message = ' (done!)'
  if (error) message = ' (failed — click to retry)'

  return (
    <Fragment>
      <button className="seedButton" onClick={handleClick} disabled={loading}>
        {error ? 'Retry seeding' : 'Seed your database'}
      </button>
      {message}
    </Fragment>
  )
}
