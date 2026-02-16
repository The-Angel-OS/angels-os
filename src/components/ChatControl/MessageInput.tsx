'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Send } from 'lucide-react'

interface MessageInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  placeholder?: string
  /** Full-page mode: larger input, centered layout */
  fullPage?: boolean
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  fullPage = false,
}: MessageInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }, [value, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const maxHeight = fullPage ? 160 : 120

  const handleInput = () => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
    }
  }

  if (fullPage) {
    return (
      <div className="border-t border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-end gap-3 px-4 py-4">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
            style={{ maxHeight: `${maxHeight}px` }}
          />
          <button
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="pb-2 text-center text-[10px] text-muted-foreground/30">
          Press Enter to send &middot; Shift+Enter for new line
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2 border-t border-border p-3">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
        style={{ maxHeight: '120px' }}
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Send message"
      >
        <Send size={16} />
      </button>
    </div>
  )
}
