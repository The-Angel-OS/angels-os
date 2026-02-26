'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Send, Paperclip, X, FileText, FileArchive, FileSpreadsheet, Film } from 'lucide-react'

/** Max file size per attachment: 25 MB */
const MAX_FILE_SIZE = 25 * 1024 * 1024

/** File type categories for preview rendering */
function getFileCategory(file: File): 'image' | 'video' | 'document' | 'archive' | 'spreadsheet' | 'other' {
  const type = file.type
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  if (type.includes('zip') || type.includes('rar') || type.includes('tar') || type.includes('gz')) return 'archive'
  if (type.includes('spreadsheet') || type.includes('csv') || type.includes('excel')) return 'spreadsheet'
  if (type.includes('pdf') || type.includes('document') || type.includes('text') || type.includes('word')) return 'document'
  return 'other'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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

  const [fileError, setFileError] = useState<string | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setFileError(null)

    const newFiles = Array.from(files)
    const oversized = newFiles.filter((f) => f.size > MAX_FILE_SIZE)
    if (oversized.length > 0) {
      setFileError(`${oversized.map((f) => f.name).join(', ')} exceeds 25 MB limit`)
      // Still add the valid files
      const valid = newFiles.filter((f) => f.size <= MAX_FILE_SIZE)
      if (valid.length > 0) setAttachments((prev) => [...prev, ...valid])
    } else {
      setAttachments((prev) => [...prev, ...newFiles])
    }
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled) return
      setFileError(null)
      const files = Array.from(e.dataTransfer.files)
      const oversized = files.filter((f) => f.size > MAX_FILE_SIZE)
      if (oversized.length > 0) {
        setFileError(`${oversized.map((f) => f.name).join(', ')} exceeds 25 MB limit`)
      }
      const valid = files.filter((f) => f.size <= MAX_FILE_SIZE)
      if (valid.length > 0) setAttachments((prev) => [...prev, ...valid])
    },
    [disabled],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const attachButton = (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={disabled}
      className="flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-muted disabled:opacity-40 h-9 w-9 md:h-8 md:w-8"
      title="Attach files"
      aria-label="Attach files"
    >
      <Paperclip size={18} className="md:h-4 md:w-4" />
    </button>
  )

  const thumbnailRow = attachments.length > 0 && (
    <div className="flex flex-col gap-1 px-3 py-2">
      {fileError && (
        <p className="text-xs text-destructive">{fileError}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {attachments.map((file, i) => {
          const category = getFileCategory(file)
          return (
            <div key={`${file.name}-${i}`} className="relative group">
              {category === 'image' ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-14 w-14 rounded-lg object-cover border border-border"
                />
              ) : (
                <div className="flex h-14 w-14 flex-col items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
                  {category === 'video' ? <Film size={20} /> :
                   category === 'archive' ? <FileArchive size={20} /> :
                   category === 'spreadsheet' ? <FileSpreadsheet size={20} /> :
                   <FileText size={20} />}
                  <span className="mt-0.5 text-[8px] uppercase">{file.name.split('.').pop()}</span>
                </div>
              )}
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
          )
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {attachments.length} file{attachments.length !== 1 ? 's' : ''} &middot;{' '}
        {formatFileSize(attachments.reduce((sum, f) => sum + f.size, 0))}
      </p>
    </div>
  )

  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.json,.md"
      multiple
      className="hidden"
      onChange={handleFileSelect}
    />
  )

  if (fullPage) {
    return (
      <div className="border-t border-border bg-background/80 backdrop-blur-sm" onDrop={handleDrop} onDragOver={handleDragOver}>
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
    <div className="border-t border-border" onDrop={handleDrop} onDragOver={handleDragOver}>
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
