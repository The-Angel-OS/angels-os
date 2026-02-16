'use client'

import { useChat } from '@/components/ChatControl/useChat'
import { MessageList } from '@/components/ChatControl/MessageList'
import { MessageInput } from '@/components/ChatControl/MessageInput'

/**
 * LEO Full-Page Chat — immersive conversational interface.
 *
 * Features:
 *  - Full-bleed layout filling the entire main area
 *  - Streaming responses with real-time text + cursor animation
 *  - Tool call status indicators ("Looking up products…")
 *  - Infinite scroll (scroll to top loads older messages)
 *  - Message grouping + date separators
 *  - Centered max-w-3xl content with generous spacing
 *  - Slim identity bar + anchored input
 *
 * @param spaceId - Resolved server-side from the tenant's default space.
 * @param userName - Current user's name for the identity bar.
 */
export function LEOChat({ spaceId, userName }: { spaceId?: string; userName?: string }) {
  const {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    sendMessage,
    loadMoreMessages,
  } = useChat(spaceId || '1', 'general')

  return (
    <div className="flex h-full flex-col">
      {/* ─── Slim identity bar ─── */}
      <div className="flex items-center gap-3 border-b border-border/50 px-4 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-[9px] font-bold text-white">
          &#10022;
        </div>
        <div className="flex-1">
          <span className="text-sm font-medium">LEO</span>
          <span className="ml-2 text-xs text-muted-foreground/60">Guardian Angel</span>
        </div>
        {userName && (
          <span className="text-xs text-muted-foreground/40">
            Speaking with {userName}
          </span>
        )}
      </div>

      {/* ─── Message area ─── */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        fullPage
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        onLoadMore={loadMoreMessages}
      />

      {/* ─── Input area ─── */}
      <MessageInput
        onSend={sendMessage}
        disabled={isLoading}
        placeholder="Ask LEO anything…"
        fullPage
      />
    </div>
  )
}
