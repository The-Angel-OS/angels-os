'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface StandingOrder {
  id: string
  text: string
  priority: 'standard' | 'priority' | 'critical'
  enabled: boolean
  createdAt: number
}

const STORAGE_KEY = 'angel-os-standing-orders'

const PRIORITY_COLORS = {
  standard: 'var(--lcars-blue)',
  priority: 'var(--lcars-amber)',
  critical: 'var(--lcars-red)',
}

export function StandingOrders() {
  const [orders, setOrders] = useState<StandingOrder[]>([])
  const [newText, setNewText] = useState('')
  const [newPriority, setNewPriority] = useState<StandingOrder['priority']>('standard')
  const [loaded, setLoaded] = useState(false)

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setOrders(parsed)
      }
    } catch {
      // ignore corrupted data
    }
    setLoaded(true)
  }, [])

  // Persist to localStorage
  const persist = useCallback((updated: StandingOrder[]) => {
    setOrders(updated)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // ignore
    }
  }, [])

  const addOrder = () => {
    const trimmed = newText.trim()
    if (!trimmed) return
    const order: StandingOrder = {
      id: `so_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: trimmed,
      priority: newPriority,
      enabled: true,
      createdAt: Date.now(),
    }
    persist([order, ...orders])
    setNewText('')
  }

  const toggleOrder = (id: string) => {
    persist(orders.map((o) => (o.id === id ? { ...o, enabled: !o.enabled } : o)))
  }

  const removeOrder = (id: string) => {
    persist(orders.filter((o) => o.id !== id))
  }

  if (!loaded) return null

  return (
    <div className="space-y-4">
      <p
        className="text-xs font-mono uppercase tracking-wider"
        style={{ color: 'var(--lcars-amber)' }}
      >
        Standing Orders
      </p>

      {/* Add order form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addOrder()}
          placeholder="New standing order..."
          className="flex-1 rounded px-3 py-2 text-sm font-mono border outline-none"
          style={{
            background: 'rgba(17, 17, 34, 0.8)',
            borderColor: 'rgba(245, 166, 35, 0.15)',
            color: 'var(--lcars-text)',
          }}
        />
        <select
          value={newPriority}
          onChange={(e) => setNewPriority(e.target.value as StandingOrder['priority'])}
          className="rounded px-2 py-2 text-xs font-mono border"
          style={{
            background: 'rgba(17, 17, 34, 0.8)',
            borderColor: 'rgba(245, 166, 35, 0.15)',
            color: 'var(--lcars-text-muted)',
          }}
        >
          <option value="standard">STD</option>
          <option value="priority">PRI</option>
          <option value="critical">CRT</option>
        </select>
        <button
          type="button"
          onClick={addOrder}
          className="rounded px-3 py-2 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
          style={{
            background: 'rgba(245, 166, 35, 0.1)',
            color: 'var(--lcars-amber)',
            border: '1px solid rgba(245, 166, 35, 0.2)',
          }}
        >
          Add
        </button>
      </div>

      {/* Orders list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {orders.length === 0 && (
          <p className="text-xs font-mono text-center py-4" style={{ color: 'var(--lcars-text-muted)' }}>
            No standing orders. LEO operates under constitutional defaults.
          </p>
        )}
        {orders.map((order) => (
          <div
            key={order.id}
            className="flex items-center gap-3 rounded px-3 py-2.5 group"
            style={{
              background: order.enabled ? 'rgba(17, 17, 34, 0.5)' : 'rgba(17, 17, 34, 0.2)',
              borderLeft: `3px solid ${PRIORITY_COLORS[order.priority]}`,
              opacity: order.enabled ? 1 : 0.5,
            }}
          >
            {/* Toggle */}
            <button
              type="button"
              onClick={() => toggleOrder(order.id)}
              className="flex-shrink-0 w-4 h-4 rounded-sm border cursor-pointer"
              style={{
                borderColor: PRIORITY_COLORS[order.priority],
                background: order.enabled
                  ? `color-mix(in srgb, ${PRIORITY_COLORS[order.priority]} 30%, transparent)`
                  : 'transparent',
              }}
              title={order.enabled ? 'Disable order' : 'Enable order'}
            >
              {order.enabled && (
                <svg viewBox="0 0 16 16" fill={PRIORITY_COLORS[order.priority]} className="w-full h-full">
                  <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
                </svg>
              )}
            </button>

            {/* Text */}
            <span
              className="flex-1 text-sm font-mono"
              style={{
                color: order.enabled ? 'var(--lcars-text)' : 'var(--lcars-text-muted)',
                textDecoration: order.enabled ? 'none' : 'line-through',
              }}
            >
              {order.text}
            </span>

            {/* Priority badge */}
            <span
              className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded"
              style={{
                color: PRIORITY_COLORS[order.priority],
                background: `color-mix(in srgb, ${PRIORITY_COLORS[order.priority]} 10%, transparent)`,
              }}
            >
              {order.priority.slice(0, 3)}
            </span>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => removeOrder(order.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs cursor-pointer"
              style={{ color: 'var(--lcars-red)' }}
              title="Remove order"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
