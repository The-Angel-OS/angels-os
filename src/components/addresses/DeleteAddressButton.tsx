'use client'

import React, { useState } from 'react'

/**
 * Remove an address. The ecommerce plugin's useAddresses hook exposes create +
 * update but NO delete, so there was no way to clear a bad address (Ken's case:
 * a garbage entry stuck next to the good one). The addresses collection grants
 * DELETE to the document owner, so this hits the REST endpoint directly, then
 * reloads the listing (the hook has no external-refresh method).
 */
export function DeleteAddressButton({ id }: { id: string | number }) {
  const [busy, setBusy] = useState(false)

  const onDelete = async () => {
    if (!window.confirm('Remove this address? This cannot be undone.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/addresses/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      setBusy(false)
      window.alert('Could not remove that address. Please try again.')
    } catch {
      setBusy(false)
      window.alert('Could not remove that address. Please try again.')
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="text-sm font-medium text-destructive hover:underline disabled:opacity-50"
    >
      {busy ? 'Removing…' : 'Remove'}
    </button>
  )
}
