'use client'

/**
 * FederationView — the Federation page shell. Two modes, one page:
 *   • SIMULATOR — the emergent-network control panel + star (materialize the
 *     federation from its perfect future; graft nodes live one at a time).
 *   • REGISTRY  — the live LCARS view of the federation as it actually is.
 *
 * A thin tab keeps both whole — the working LCARS view is untouched.
 */
import React, { useState } from 'react'
import FederationNetworkLCARS from './FederationNetworkLCARS'
import FederationSimulator from './FederationSimulator'

type Tab = 'simulator' | 'registry'

const TAB_AMBER = '#f5a623'
const TAB_CARD = '#111122'
const TAB_MUTED = '#7788aa'

export default function FederationView() {
  const [tab, setTab] = useState<Tab>('simulator')

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: '#000' }}>
      <div className="flex shrink-0 items-center gap-1 px-2 pt-2">
        {(['simulator', 'registry'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="rounded-t-lg px-4 py-1.5 font-mono text-[11px] font-bold tracking-wider transition-colors"
            style={{ background: tab === t ? TAB_AMBER : TAB_CARD, color: tab === t ? '#000' : TAB_MUTED }}
          >
            {t === 'simulator' ? 'SIMULATOR' : 'LIVE REGISTRY'}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'simulator' ? <FederationSimulator /> : <FederationNetworkLCARS />}
      </div>
    </div>
  )
}
