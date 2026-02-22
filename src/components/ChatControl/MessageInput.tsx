'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Send, Paperclip, X } from 'lucide-react'

interface MessageInputProps {
  onSend: (content: string, attachments?: File[]) => void
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
  const [attachments, setAttachments] = useState<File[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(() => {
    if ((!value.trim() && attachments.length === 0) || disabled) return
    onSend(value.trim(), attachments.length > 0 ? attachments : undefined)
    setValue('')
    setAttachments([])
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }, [value, attachments, disabled, onSend])

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setAttachments((prev) => [...prev, ...Array.from(files)])
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const attachButton = (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={disabled}
      className="flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-muted disabled:opacity-40 h-9 w-9 md:h-8 md:w-8"
      title="Attach images"
      aria-label="Attach images"
    >
      <Paperclip size={18} className="md:h-4 md:w-4" />
    </button>
  )

  const thumbnailRow = attachments.length > 0 && (
    <div className="flex flex-wrap gap-2 px-3 py-2">
      {attachments.map((file, i) => (
        <div key={`${file.name}-${i}`} className="relative group">
          <img
            src={URL.createObjectURL(file)}
            alt={file.name}
            className="h-14 w-14 rounded-lg object-cover border border-border"
          />
          <button
            type="button"
            onClick={() => removeAttachment(i)}
            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={`Remove ${file.name}`}
          >
            <X size={12} />
          </button>
          <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 text-[9px] text-white px-1 rounded-b-lg">
            {file.name.length > 10 ? `${file.name.slice(0, 8)}...` : file.name}
          </span>
        </div>
      ))}
    </div>
  )

  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      multiple
      capture="environment"
      className="hidden"
      onChange={handleFileSelect}
    />
  )

  if (fullPage) {
    return (
      <div className="border-t border-border bg-background/80 backdrop-blur-sm">
        {thumbnailRow}
        <div className="mx-auto flex max-w-3xl items-end gap-3 px-4 py-4">
          {attachButton}
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
            disabled={disabled || (!value.trim() && attachments.length === 0)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </div>
        {hiddenFileInput}
        <div className="pb-2 text-center text-[10px] text-muted-foreground/30">
          Press Enter to send &middot; Shift+Enter for new line
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-border">
      {thumbnailRow}
      <div className="flex items-end gap-2 p-3">
        {attachButton}
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-base md:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
          style={{ maxHeight: '120px', fontSize: '16px' }}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || (!value.trim() && attachments.length === 0)}
          className="flex h-10 w-10 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          <Send size={18} className="md:h-4 md:w-4" />
        </button>
      </div>
      {hiddenFileInput}
    </div>
  )
}
