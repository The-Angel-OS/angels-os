'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Send, Paperclip, X, FileText, FileArchive, FileSpreadsheet, Film, Image as ImageIcon, Images } from 'lucide-react'
import { MediaPicker } from '@/app/[locale]/(dashboard)/dashboard/endeavor/MediaPicker'

/** A reused image already in cloud storage — attached by reference, not re-uploaded. */
type ReusedMedia = { id: number | string; url: string }

/** Max file size per attachment: 25 MB */
const MAX_FILE_SIZE = 25 * 1024 * 1024

/** Max message length (chars) — matches server-side limit */
const MAX_MESSAGE_LENGTH = 50_000

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

/** Category → accent color for file chip styling */
const FILE_CHIP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  document: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20' },
  video: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/20' },
  archive: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' },
  spreadsheet: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
  other: { bg: 'bg-gray-500/10', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-500/20' },
}

/** Gemini-style file chip for non-image attachments */
function FileChip({
  file,
  onRemove,
}: {
  file: File
  onRemove: () => void
}) {
  const category = getFileCategory(file)
  const colors = FILE_CHIP_COLORS[category] || FILE_CHIP_COLORS.other
  const ext = file.name.split('.').pop()?.toUpperCase() || '?'
  const displayName = file.name.length > 18 ? `${file.name.slice(0, 15)}…` : file.name

  const Icon = category === 'video' ? Film
    : category === 'archive' ? FileArchive
    : category === 'spreadsheet' ? FileSpreadsheet
    : FileText

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-xl border px-3 py-2 transition-all duration-200 hover:shadow-sm ${colors.bg} ${colors.border}`}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colors.bg} ${colors.text}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{displayName}</p>
        <p className="text-[10px] text-muted-foreground">
          {ext} · {formatFileSize(file.size)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground/60 opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
        aria-label={`Remove ${file.name}`}
      >
        <X size={10} />
      </button>
    </div>
  )
}

/** Gemini-style image thumbnail for image attachments */
function ImageThumbnail({
  file,
  onRemove,
}: {
  file: File
  onRemove: () => void
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file])

  useEffect(() => {
    return () => URL.revokeObjectURL(url)
  }, [url])

  return (
    <div className="group relative shrink-0 overflow-hidden rounded-xl border border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30">
      <img
        src={url}
        alt={file.name}
        className="h-16 w-16 object-cover"
        loading="lazy"
      />
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive"
        aria-label={`Remove ${file.name}`}
      >
        <X size={10} />
      </button>
      {/* Filename badge */}
      <span className="absolute bottom-0.5 left-0.5 right-0.5 truncate rounded-md bg-black/50 px-1 py-0.5 text-[8px] text-white/90 backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100">
        {file.name.length > 12 ? `${file.name.slice(0, 10)}…` : file.name}
      </span>
    </div>
  )
}

interface MessageInputProps {
  onSend: (content: string, attachments?: File[], existingMedia?: ReusedMedia[]) => void
  disabled?: boolean
  placeholder?: string
  /** Full-page mode: larger input, centered layout */
  fullPage?: boolean
  /** When set (with channelSlug), shows a "reuse from channel/library" picker button. */
  spaceId?: string | number | null
  channelSlug?: string | null
  /** Scope the reuse picker's Library tab to a tenant. */
  tenantId?: string | number | null
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  fullPage = false,
  spaceId,
  channelSlug,
  tenantId,
}: MessageInputProps) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [reused, setReused] = useState<ReusedMedia[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const canReuse = !!(spaceId && channelSlug)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const isOverLimit = value.length > MAX_MESSAGE_LENGTH

  const handleSubmit = useCallback(() => {
    if ((!value.trim() && attachments.length === 0 && reused.length === 0) || disabled || isOverLimit) return
    onSend(
      value.trim(),
      attachments.length > 0 ? attachments : undefined,
      reused.length > 0 ? reused : undefined,
    )
    setValue('')
    setAttachments([])
    setReused([])
    // Defer height reset to avoid synchronous reflow during submit
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.style.height = 'auto'
      }
    })
  }, [value, attachments, reused, disabled, isOverLimit, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const maxHeight = fullPage ? 160 : 120
  const rafRef = useRef<number>(0)

  const handleInput = () => {
    // Defer DOM read/write to next animation frame to avoid blocking INP
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const el = inputRef.current
      if (el) {
        el.style.height = 'auto'
        el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
      }
    })
  }

  // Cleanup rAF on unmount
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const [fileError, setFileError] = useState<string | null>(null)

  const addFiles = useCallback(
    (files: File[]) => {
      setFileError(null)
      const oversized = files.filter((f) => f.size > MAX_FILE_SIZE)
      if (oversized.length > 0) {
        setFileError(`${oversized.map((f) => f.name).join(', ')} exceeds 25 MB limit`)
      }
      const valid = files.filter((f) => f.size <= MAX_FILE_SIZE)
      if (valid.length > 0) {
        setAttachments((prev) => [...prev, ...valid])
        // Scroll to end of thumbnail bar after adding
        requestAnimationFrame(() => {
          scrollContainerRef.current?.scrollTo({
            left: scrollContainerRef.current.scrollWidth,
            behavior: 'smooth',
          })
        })
      }
    },
    [],
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    addFiles(Array.from(files))
    e.target.value = ''
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      if (disabled) return
      addFiles(Array.from(e.dataTransfer.files))
    },
    [disabled, addFiles],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Split attachments into images and files for Gemini-style layout
  const images = attachments.filter((f) => getFileCategory(f) === 'image')
  const files = attachments.filter((f) => getFileCategory(f) !== 'image')
  const hasAttachments = attachments.length > 0 || reused.length > 0

  const removeReused = useCallback((id: number | string) => {
    setReused((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const addReused = useCallback((items: ReusedMedia[]) => {
    setReused((prev) => {
      const seen = new Set(prev.map((m) => String(m.id)))
      return [...prev, ...items.filter((m) => !seen.has(String(m.id)))]
    })
    setPickerOpen(false)
  }, [])

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

  // Reuse-from-channel/library button — only when a channel context is provided.
  const reuseButton = canReuse ? (
    <button
      type="button"
      onClick={() => setPickerOpen(true)}
      disabled={disabled}
      className="flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-muted disabled:opacity-40 h-9 w-9 md:h-8 md:w-8"
      title="Reuse images from this channel or the library"
      aria-label="Reuse existing images"
    >
      <Images size={18} className="md:h-4 md:w-4" />
    </button>
  ) : null

  const pickerModal = pickerOpen ? (
    <MediaPicker
      multiple
      defaultSource="channel"
      spaceId={spaceId}
      channelSlug={channelSlug}
      tenantId={tenantId}
      onSelect={(m) => addReused([m])}
      onConfirm={(items) => addReused(items)}
      onClose={() => setPickerOpen(false)}
    />
  ) : null

  // Gemini-style attachment preview bar (inside the input container)
  const attachmentBar = hasAttachments && (
    <div className="px-3 pt-3 pb-1 space-y-2">
      {/* Error message */}
      {fileError && (
        <p className="text-xs text-destructive animate-in fade-in duration-200">{fileError}</p>
      )}

      {/* Horizontal scrollable thumbnail row */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scrollbar-none pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Image thumbnails first */}
        {images.map((file, i) => (
          <ImageThumbnail
            key={`img-${file.name}-${file.size}-${i}`}
            file={file}
            onRemove={() => removeAttachment(attachments.indexOf(file))}
          />
        ))}
        {/* Reused (by-reference) channel/library images */}
        {reused.map((m) => (
          <div key={`reused-${m.id}`} className="group relative shrink-0 overflow-hidden rounded-xl border border-primary/40 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt="" className="h-16 w-16 object-cover" loading="lazy" />
            <span className="absolute bottom-0.5 left-0.5 rounded bg-primary/80 px-1 py-0.5 text-[8px] font-medium text-primary-foreground">reuse</span>
            <button
              type="button"
              onClick={() => removeReused(m.id)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive"
              aria-label="Remove reused image"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        {/* File chips after images */}
        {files.map((file, i) => (
          <div key={`file-${file.name}-${file.size}-${i}`} className="shrink-0">
            <FileChip
              file={file}
              onRemove={() => removeAttachment(attachments.indexOf(file))}
            />
          </div>
        ))}
      </div>

      {/* Summary line */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
        <span>
          {attachments.length > 0 && (
            <>{attachments.length} file{attachments.length !== 1 ? 's' : ''} · {formatFileSize(attachments.reduce((sum, f) => sum + f.size, 0))}</>
          )}
          {attachments.length > 0 && reused.length > 0 && ' · '}
          {reused.length > 0 && <>{reused.length} reused</>}
        </span>
        <button
          type="button"
          onClick={() => { setAttachments([]); setReused([]); setFileError(null) }}
          className="text-muted-foreground/40 hover:text-destructive transition-colors"
        >
          Clear all
        </button>
      </div>
    </div>
  )

  const hiddenFileInput = (
    <input
      title="File input"
      aria-label="File input"
      ref={fileInputRef}
      type="file"
      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.json,.md"
      multiple
      className="hidden"
      onChange={handleFileSelect}
    />
  )

  // Drag overlay indicator
  const dragOverlay = isDragOver && (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-1 text-primary">
        <ImageIcon size={24} />
        <span className="text-sm font-medium">Drop files here</span>
      </div>
    </div>
  )

  if (fullPage) {
    return (
      <div
        className="relative border-t border-border bg-background/80 backdrop-blur-sm"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {dragOverlay}
        <div className="mx-auto max-w-3xl px-4 py-3">
          {/* Unified input container with attachments inside */}
          <div
            className={`rounded-2xl border bg-muted/30 transition-all duration-200 ${
              isDragOver
                ? 'border-primary shadow-lg shadow-primary/10'
                : hasAttachments
                  ? 'border-border shadow-sm'
                  : 'border-border'
            }`}
          >
            {attachmentBar}
            <div className="flex items-end gap-3 px-3 pb-3 pt-2">
              {attachButton}
              {reuseButton}
              <textarea
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                placeholder={placeholder}
                disabled={disabled}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
                style={{ maxHeight: `${maxHeight}px` }}
              />
              <button
                onClick={handleSubmit}
                disabled={disabled || isOverLimit || (!value.trim() && !hasAttachments)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                  isOverLimit
                    ? 'bg-destructive text-destructive-foreground'
                    : value.trim() || hasAttachments
                      ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md'
                      : 'bg-muted text-muted-foreground'
                } disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none`}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-2 text-[10px] text-muted-foreground/30">
            <span>Press Enter to send · Shift+Enter for new line</span>
            {value.length > MAX_MESSAGE_LENGTH * 0.9 && (
              <span className={isOverLimit ? 'text-destructive font-medium' : 'text-amber-500'}>
                {value.length.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        {hiddenFileInput}
        {pickerModal}
      </div>
    )
  }

  // Compact mode (sidebar/floating bubble)
  return (
    <div
      className="relative border-t border-border"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {dragOverlay}
      <div className="p-2">
        {/* Unified input container */}
        <div
          className={`rounded-xl border transition-all duration-200 ${
            isDragOver
              ? 'border-primary shadow-md shadow-primary/10'
              : hasAttachments
                ? 'border-border shadow-sm'
                : 'border-border bg-muted/50'
          }`}
        >
          {attachmentBar}
          <div className="flex items-end gap-2 px-2 pb-2 pt-1.5">
            {attachButton}
            {reuseButton}
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="flex-1 resize-none bg-transparent text-base md:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
              style={{ maxHeight: '120px', fontSize: '16px' }}
            />
            <button
              onClick={handleSubmit}
              disabled={disabled || isOverLimit || (!value.trim() && !hasAttachments)}
              className={`flex h-10 w-10 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                isOverLimit
                  ? 'bg-destructive text-destructive-foreground'
                  : value.trim() || hasAttachments
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80'
                    : 'bg-muted text-muted-foreground'
              } disabled:cursor-not-allowed disabled:opacity-40`}
              aria-label="Send message"
            >
              <Send size={18} className="md:h-4 md:w-4" />
            </button>
          </div>
        </div>
      </div>
      {hiddenFileInput}
    </div>
  )
}
