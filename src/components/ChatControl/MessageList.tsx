'use client'

import React, { useRef, useEffect } from 'react'
import type { ChatMessage } from './types'

interface MessageListProps {
  messages: ChatMessage[]
  isLoading?: boolean
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        No messages yet. Start a conversation!
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : msg.role === 'system'
                  ? 'border border-border bg-muted/50 text-muted-foreground italic'
                  : 'bg-muted text-foreground'
            }`}
          >
            {msg.role === 'leo' && msg.authorName && (
              <div className="mb-1 text-xs font-medium opacity-70">{msg.authorName}</div>
            )}
            <div className="whitespace-pre-wrap">{msg.content}</div>
            <div className="mt-1 text-[10px] opacity-50">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div className="rounded-2xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce [animation-delay:0.1s]">.</span>
              <span className="animate-bounce [animation-delay:0.2s]">.</span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
