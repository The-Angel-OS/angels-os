'use client'

import { useState, useEffect } from 'react'
import { ChatControl } from './index'
import { useAuth } from '@/providers/Auth'
import { useChatContext } from './ChatProvider'
import Link from 'next/link'

/**
 * Global floating chat bubble - appears on every page.
 * Wrap this in the root layout for site-wide LEO access.
 *
 * Authenticated users inside the dashboard get ChatProvider context.
 * Authenticated users outside the dashboard get a direct chat.
 * Guests see a teaser icon linking to login.
 *
 * @param spaceId - Resolved server-side from the tenant's default space.
 *                  If not provided, fetches user's first available space.
 */
export function FloatingBubble({ spaceId }: { spaceId?: string }) {
  const { status } = useAuth()
  const chatCtx = useChatContext()
  const [resolvedSpaceId, setResolvedSpaceId] = useState(spaceId || '')

  const [retryCount, setRetryCount] = useState(0)

  // If no spaceId prop and user is logged in, resolve from API (with retry)
  useEffect(() => {
    if (spaceId || status !== 'loggedIn' || resolvedSpaceId) return

    fetch('/api/spaces?limit=1&sort=createdAt&depth=0', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const firstSpace = data?.docs?.[0]
        if (firstSpace?.id) {
          setResolvedSpaceId(String(firstSpace.id))
        } else if (retryCount < 2) {
          // Spaces may not exist yet for new accounts — retry after delay
          const timer = setTimeout(() => setRetryCount((c) => c + 1), 3000)
          return () => clearTimeout(timer)
        }
      })
      .catch(() => {
        // Retry on network failure (up to 2 retries)
        if (retryCount < 2) {
          const timer = setTimeout(() => setRetryCount((c) => c + 1), 3000)
          return () => clearTimeout(timer)
        }
      })
  }, [spaceId, status, resolvedSpaceId, retryCount])

  // Full chat for authenticated users
  if (status === 'loggedIn') {
    // If we have ChatProvider context, use LEO DM space
    const effectiveSpaceId = chatCtx?.leoDMChannel
      ? chatCtx.leoDMChannel.spaceId
      : resolvedSpaceId

    // If no space resolved yet, show a placeholder bubble that links to dashboard
    // instead of returning null (which leaves user with no chat access)
    if (!effectiveSpaceId) {
      return (
        <Link
          href="/dashboard"
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform"
          title="Go to Dashboard to chat with LEO"
          aria-label="Go to Dashboard to chat with LEO"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          </svg>
        </Link>
      )
    }

    return (
      <ChatControl
        mode="minimalist"
        spaceId={effectiveSpaceId}
        channelSlug={chatCtx?.leoDMChannel?.slug || 'general'}
        position="bottom-right"
      />
    )
  }

  // Don't show anything until auth check completes
  if (status === undefined) return null

  // Guest chat bubble — interactive with LEO (rate-limited, no persistence)
  return <GuestChatBubble />
}

function GuestChatBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: "Hi! I'm LEO, your AI assistant. Ask me anything about this shop!" },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    try {
      const res = await fetch('/api/leo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-leo-guest': 'true',
        },
        body: JSON.stringify({ message: userMsg }),
      })

      if (res.status === 429) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: "You've reached the guest message limit. Create a free account for unlimited LEO access, message history, and personalized help!",
          },
        ])
      } else if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...prev, { role: 'assistant', text: data.text || 'Sorry, I had trouble with that.' }])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', text: 'Something went wrong. Please try again!' }])
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Connection error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform"
        title="Chat with LEO"
        aria-label="Chat with LEO"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-80 h-96 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">LEO</span>
          <span className="text-xs opacity-70">AI Assistant</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-primary-foreground/70 hover:text-primary-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-3 py-2 text-sm text-muted-foreground animate-pulse">
              LEO is thinking...
            </div>
          </div>
        )}
      </div>

      {/* Sign up CTA */}
      <div className="px-4 py-1.5 bg-muted/50 text-center">
        <Link
          href="/create-account"
          className="text-xs text-primary hover:underline"
        >
          Create a free account for full LEO access →
        </Link>
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask LEO anything..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    </div>
  )
}
