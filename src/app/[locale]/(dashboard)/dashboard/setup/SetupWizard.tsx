'use client'

/**
 * SetupWizard — Enterprise Setup Leo Wizard
 *
 * Two-panel layout:
 *   Left  — Step indicator panel (step 0–7, with status icons)
 *   Right — Leo chat (streaming, wizard-aware: sends wizardStep + wizardContext)
 *
 * Progress polling: every 3 seconds the client calls getWizardProgress()
 * to detect step advancement (Leo's tool calls complete steps server-side).
 * No custom SSE events needed — simple and reliable for a 17-minute flow.
 *
 * When the wizard is complete (step 7 ping succeeds), the wizard redirects
 * to /dashboard and the "Enterprise Setup" nav link disappears from the sidebar.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Check,
  Circle,
  Loader2,
  Send,
  ChurchIcon,
  Wand2,
  Bot,
  User,
} from 'lucide-react'
import { getWizardProgress, saveWizardProgress, loadWizardMessages } from './actions'
import { WIZARD_STEP_NAMES } from '@/utilities/wizardPrompt'
import type { WizardProgress } from './actions'

// ── Types ─────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'leo' | 'system'
  content: string
  isStreaming?: boolean
  activeToolCall?: string
}

interface SetupWizardProps {
  initialProgress: WizardProgress
  spaceId: number | null
  channelSlug: string
  tenantSlug: string
}

// ── Step Indicator ─────────────────────────────────────────────────────────

function StepIndicator({
  steps,
  currentStep,
  completedSteps,
}: {
  steps: string[]
  currentStep: number
  completedSteps: number[]
}) {
  return (
    <div className="flex flex-col gap-0.5 pt-1">
      {steps.map((name, idx) => {
        const isCompleted = completedSteps.includes(idx)
        const isCurrent = idx === currentStep
        const isFuture = !isCompleted && !isCurrent

        return (
          <div
            key={idx}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all ${
              isCurrent
                ? 'bg-primary/10 text-primary shadow-sm'
                : isCompleted
                  ? 'text-foreground/70'
                  : 'text-muted-foreground/40'
            }`}
          >
            <div
              className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                isCompleted
                  ? 'border-green-500/40 bg-green-500/10'
                  : isCurrent
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-border/50'
              }`}
            >
              {isCompleted ? (
                <Check size={12} className="text-green-600" />
              ) : isCurrent ? (
                <div className="size-2 rounded-full bg-primary" />
              ) : (
                <Circle size={10} className="opacity-20" />
              )}
            </div>
            <span className={`text-sm ${isCurrent ? 'font-semibold' : isCompleted ? 'font-medium' : ''} ${isFuture ? 'opacity-50' : ''}`}>
              {name}
            </span>
            {isCurrent && (
              <div className="ml-auto">
                <div className="size-1.5 animate-pulse rounded-full bg-primary" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Message Bubble ─────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isLeo = msg.role === 'leo'
  const isSystem = msg.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="rounded-full border border-border/50 bg-muted/50 px-3.5 py-1 text-xs font-medium text-muted-foreground">
          {msg.content}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex items-start gap-2.5 ${isLeo ? '' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div
        className={`flex size-7 shrink-0 items-center justify-center rounded-full shadow-sm ${
          isLeo ? 'bg-primary text-primary-foreground' : 'bg-foreground/10 text-foreground'
        }`}
      >
        {isLeo ? <Bot size={14} /> : <User size={14} />}
      </div>

      {/* Bubble */}
      <div
        className={`group relative max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
          isLeo
            ? 'rounded-tl-sm border border-border/40 bg-card text-card-foreground'
            : 'rounded-tr-sm bg-primary text-primary-foreground'
        }`}
      >
        {msg.activeToolCall && (
          <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 size={10} className="animate-spin" />
            <span>{msg.activeToolCall}...</span>
          </div>
        )}
        {isLeo ? (
          <div className="prose prose-sm max-w-none break-words leading-relaxed text-card-foreground prose-headings:text-card-foreground prose-strong:text-card-foreground prose-a:text-primary prose-li:marker:text-primary/60">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary underline decoration-primary/30 hover:decoration-primary" />
                ),
                p: ({ ...props }) => <p {...props} className="mb-2 last:mb-0" />,
                ul: ({ ...props }) => <ul {...props} className="my-2 space-y-1 pl-4" />,
                ol: ({ ...props }) => <ol {...props} className="my-2 space-y-1 pl-4" />,
                li: ({ ...props }) => <li {...props} className="text-card-foreground" />,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
        )}
        {msg.isStreaming && (
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse rounded-full bg-primary/60" />
        )}
      </div>
    </div>
  )
}

// ── Main Wizard Component ──────────────────────────────────────────────────

export function SetupWizard({ initialProgress, spaceId, channelSlug, tenantSlug }: SetupWizardProps) {
  const router = useRouter()

  // Wizard state
  const [progress, setProgress] = useState<WizardProgress>(initialProgress)
  const [wizardComplete, setWizardComplete] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Scroll to bottom ──────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // ── Load existing messages or trigger welcome ──────────────────────────
  useEffect(() => {
    let cancelled = false
    async function init() {
      // Try loading existing conversation
      const existing = await loadWizardMessages(channelSlug)
      if (cancelled) return

      if (existing.length > 0) {
        // Restore chat history
        setMessages([
          { id: 'welcome', role: 'system', content: 'Enterprise Setup — Conversation restored' },
          ...existing,
        ])
      } else {
        // Fresh wizard — trigger Leo's opening message
        setMessages([
          { id: 'welcome', role: 'system', content: 'Enterprise Setup — Leo is ready' },
        ])
        sendToLeo(
          'Start the Enterprise setup wizard. Introduce yourself as Leo. Explain that an Enterprise is a PLATFORM that hosts Endeavors (businesses/projects). List EXACTLY these 8 steps by name: 1. Welcome, 2. Identity, 3. Endeavor Type, 4. First Space, 5. First Member, 6. First Offering, 7. Payments, 8. Federation. Confirm they are ready to begin.',
          true,
        )
      }
    }
    init()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Progress polling ──────────────────────────────────────────────────
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const result = await getWizardProgress()
        if (result.wizardComplete && !wizardComplete) {
          setWizardComplete(true)
          setProgress(result.progress)
          // Give Leo's final message a moment to finish streaming, then redirect
          setTimeout(() => {
            router.push('/dashboard')
            router.refresh()
          }, 4000)
          return
        }
        // Update step if advanced
        if (result.progress.currentStep > progress.currentStep) {
          setProgress(result.progress)
        }
        if (result.progress.completedSteps.length > progress.completedSteps.length) {
          setProgress(result.progress)
        }
      } catch {
        // Non-critical
      }
    }, 3000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.currentStep, progress.completedSteps.length, wizardComplete])

  // ── Stream response from Leo ──────────────────────────────────────────
  const sendToLeo = useCallback(
    async (userMessage: string, isOpening = false) => {
      // Cancel any existing stream
      if (abortRef.current) abortRef.current.abort()
      abortRef.current = new AbortController()

      const leoMsgId = `leo-${Date.now()}`

      setMessages((prev) => [
        ...prev,
        ...(isOpening
          ? []
          : [
              {
                id: `user-${Date.now()}`,
                role: 'user' as const,
                content: userMessage,
              },
            ]),
        {
          id: leoMsgId,
          role: 'leo' as const,
          content: '',
          isStreaming: true,
        },
      ])

      try {
        const response = await fetch('/api/leo/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantSlug,
          },
          body: JSON.stringify({
            message: isOpening
              ? userMessage || 'Start the Enterprise setup wizard. Introduce yourself as Leo. Explain that an Enterprise is a PLATFORM that hosts Endeavors (businesses/projects). List EXACTLY these 8 steps by name: 1. Welcome, 2. Identity, 3. Endeavor Type, 4. First Space, 5. First Member, 6. First Offering, 7. Payments, 8. Federation.'
              : userMessage,
            channelSlug,
            spaceId,
            wizardStep: progress.currentStep,
            wizardContext: {
              operatorName: progress.operatorName,
              enterpriseName: progress.enterpriseName,
              endeavorType: progress.endeavorType,
              completedSteps: progress.completedSteps,
              tenantSlug,
            },
          }),
          signal: abortRef.current.signal,
        })

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let eventType = 'delta'

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                switch (eventType) {
                  case 'delta':
                    // Append streaming text chunk
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === leoMsgId
                          ? { ...m, content: m.content + String(data.text || ''), activeToolCall: undefined }
                          : m,
                      ),
                    )
                    break

                  case 'tool_call':
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === leoMsgId
                          ? { ...m, activeToolCall: String(data.name || 'Working…') }
                          : m,
                      ),
                    )
                    break

                  case 'done':
                    // Finalize — do NOT append text (already accumulated via deltas)
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === leoMsgId
                          ? { ...m, isStreaming: false, activeToolCall: undefined }
                          : m,
                      ),
                    )
                    break

                  case 'error':
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === leoMsgId
                          ? { ...m, content: m.content || 'Something went wrong. Please try again.', isStreaming: false }
                          : m,
                      ),
                    )
                    break
                }
              } catch {
                // Malformed SSE data — skip
              }
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
        setMessages((prev) =>
          prev.map((m) =>
            m.id === leoMsgId
              ? {
                  ...m,
                  content: m.content || 'Something went wrong. Please try again.',
                  isStreaming: false,
                }
              : m,
          ),
        )
      } finally {
        setIsSending(false)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === leoMsgId ? { ...m, isStreaming: false } : m,
          ),
        )
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress, channelSlug, spaceId, tenantSlug],
  )

  // ── Handle send ───────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isSending) return

    setInput('')
    setIsSending(true)
    await sendToLeo(text)
  }, [input, isSending, sendToLeo])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      {/* ── Left: Step Panel ── */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-border/60 bg-muted/30">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Wand2 size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Enterprise Setup</p>
            <p className="text-xs text-muted-foreground">
              Step {progress.currentStep + 1} of {WIZARD_STEP_NAMES.length}
            </p>
          </div>
        </div>

        {/* Step list */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <StepIndicator
            steps={WIZARD_STEP_NAMES}
            currentStep={progress.currentStep}
            completedSteps={progress.completedSteps}
          />
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <ChurchIcon size={13} className="text-muted-foreground/70" />
            <p className="text-xs text-muted-foreground/70">~17 min · guided by Leo</p>
          </div>
        </div>
      </aside>

      {/* ── Right: Leo Chat ── */}
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        {/* Chat header */}
        <div className="flex items-center gap-3 border-b border-border/60 bg-card px-5 py-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Bot size={15} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Leo</p>
            <p className="text-xs text-muted-foreground">
              {WIZARD_STEP_NAMES[progress.currentStep] ?? 'Enterprise Setup'}
            </p>
          </div>
          {wizardComplete && (
            <div className="ml-auto flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600">
              <Check size={11} />
              Complete — redirecting…
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border/60 bg-card px-4 py-3">
          <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-background px-3 py-2.5 shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                wizardComplete
                  ? 'Setup complete!'
                  : 'Talk to Leo…'
              }
              disabled={wizardComplete || isSending}
              rows={1}
              className="max-h-32 flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
              style={{ minHeight: '24px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isSending || wizardComplete}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-30 disabled:shadow-none"
            >
              {isSending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-muted-foreground/50">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
