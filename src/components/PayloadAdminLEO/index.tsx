'use client'

import React, { useState, useEffect } from 'react'
import { MessageList } from '@/components/ChatControl/MessageList'
import { MessageInput } from '@/components/ChatControl/MessageInput'
import { useChat } from '@/components/ChatControl/useChat'

/**
 * PayloadAdminLEO — Floating LEO chat toggle in the Payload admin panel.
 *
 * Registered via payload.config.ts → admin.components.afterNavLinks.
 * Reads the active tenant from the `payload-tenant` cookie and resolves
 * the tenant's default space for scoped LEO conversations.
 */
export const PayloadAdminLEO: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [spaceId, setSpaceId] = useState<string>('')

  // Resolve default space from tenant cookie
  useEffect(() => {
    const tenantCookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith('payload-tenant='))
      ?.split('=')[1]

    if (!tenantCookie) {
      // Fallback: fetch first available space
      fetch('/api/spaces?limit=1&sort=createdAt&depth=0', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.docs?.[0]?.id) setSpaceId(String(data.docs[0].id))
        })
        .catch(() => {})
      return
    }

    // Fetch spaces for this tenant
    fetch(`/api/spaces?where[tenant][equals]=${tenantCookie}&limit=1&depth=0`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.docs?.[0]?.id) setSpaceId(String(data.docs[0].id))
      })
      .catch(() => {})
  }, [])

  const { messages, isLoading, sendMessage } = useChat(spaceId || '', 'general')

  // Don't render until we have a space
  if (!spaceId) {
    return (
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          opacity: 0.5,
        }}
        title="LEO (loading...)"
      >
        &#10022;
      </button>
    )
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: isOpen
            ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
            : 'linear-gradient(135deg, #2563eb, #4f46e5)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          transition: 'all 0.2s ease',
        }}
        title={isOpen ? 'Close LEO' : 'Chat with LEO'}
      >
        {isOpen ? '\u2715' : '\u2726'}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '84px',
            right: '24px',
            zIndex: 9998,
            width: '380px',
            height: '500px',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--theme-bg, #fff)',
            border: '1px solid var(--theme-elevation-100, #e0e0e0)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--theme-elevation-100, #e0e0e0)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--theme-elevation-50, #f8f8f8)',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
            >
              &#10022;
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>LEO Assistant</div>
              <div style={{ fontSize: '11px', color: 'var(--theme-elevation-500, #888)' }}>
                Admin AI Guardian
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <MessageList messages={messages} isLoading={isLoading} />
          </div>

          {/* Input */}
          <MessageInput
            onSend={sendMessage}
            disabled={isLoading}
            placeholder="Ask LEO about your data..."
          />
        </div>
      )}
    </>
  )
}
