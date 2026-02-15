'use client'

import React, { useCallback, useEffect, useState, useTransition } from 'react'
import { getTenantsList, type TenantSummary } from '../actions'
import { exportTenantSuitcase, importTenantSuitcase } from './actions'

export default function SuitcaseManager() {
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | number | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(
    null,
  )
  const [dragOver, setDragOver] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    loadTenants()
  }, [])

  async function loadTenants() {
    setLoading(true)
    const result = await getTenantsList()
    setTenants(result.tenants)
    setLoading(false)
  }

  async function handleExport(tenantId: string | number) {
    setExporting(tenantId)
    try {
      const result = await exportTenantSuitcase(tenantId)
      if (result.success && result.data) {
        // Create download
        const json = JSON.stringify(result.data, null, 2)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${result.data.manifest.tenant.slug}-suitcase-${Date.now()}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        alert(result.error || 'Export failed')
      }
    } catch {
      alert('Export failed')
    }
    setExporting(null)
  }

  const handleImportFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.json')) {
        setImportResult({ success: false, message: 'Only .json suitcase files are accepted' })
        return
      }

      setImporting(true)
      setImportResult(null)

      try {
        const text = await file.text()

        // Validate basic structure before sending to server
        const parsed = JSON.parse(text)
        if (!parsed.manifest || !parsed.tenant) {
          setImportResult({ success: false, message: 'Invalid suitcase format - missing manifest or tenant data' })
          setImporting(false)
          return
        }

        startTransition(async () => {
          const result = await importTenantSuitcase(text)
          if (result.success) {
            setImportResult({
              success: true,
              message: `Tenant imported successfully (ID: ${result.tenantId})`,
            })
            await loadTenants()
          } else {
            setImportResult({
              success: false,
              message: result.error || 'Import failed',
            })
          }
          setImporting(false)
        })
      } catch {
        setImportResult({ success: false, message: 'Failed to parse suitcase file' })
        setImporting(false)
      }
    },
    [startTransition],
  )

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      handleImportFile(file)
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      handleImportFile(file)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Suitcase Manager</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Export tenants as portable suitcases or import from another Angel OS Core instance
        </p>
      </div>

      {/* Import Zone */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Import Suitcase</h2>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
            dragOver
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
              : 'border-border hover:border-muted-foreground'
          }`}
        >
          {importing || isPending ? (
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              <p className="text-sm font-medium">Unpacking suitcase...</p>
            </div>
          ) : (
            <>
              <svg className="mb-3 h-10 w-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-sm font-medium">
                Drop a suitcase file here, or{' '}
                <label className="cursor-pointer text-emerald-600 underline hover:text-emerald-700">
                  browse
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Only .json suitcase files from Angel OS Core instances are accepted
              </p>
            </>
          )}
        </div>

        {/* Import Result */}
        {importResult && (
          <div
            className={`rounded-lg border p-4 ${
              importResult.success
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300'
            }`}
          >
            <p className="text-sm font-medium">{importResult.message}</p>
          </div>
        )}
      </div>

      {/* Export Section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Export Tenant</h2>
        <p className="text-sm text-muted-foreground">
          Pack a tenant into a suitcase for transfer to another Angel OS Core instance
        </p>

        {tenants.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No tenants available for export</p>
        ) : (
          <div className="space-y-2">
            {tenants.map((tenant) => (
              <div
                key={String(tenant.id)}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{tenant.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {tenant.slug} &middot; {tenant.spacesCount} spaces &middot;{' '}
                    {tenant.usersCount} members
                  </p>
                </div>
                <button
                  onClick={() => handleExport(tenant.id)}
                  disabled={exporting === tenant.id}
                  className="ml-4 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {exporting === tenant.id ? 'Packing...' : 'Export'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
