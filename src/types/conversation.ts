/**
 * Conversation types for LEO / ConversationEngine.
 * @see https://github.com/The-Angel-OS/angel-os/blob/main/src/utilities/ConversationEngine.ts
 */

export interface DetectedIntent {
  intentId: string
  name: string
  confidence: number
  entities: Array<{ name: string; value: unknown }>
  timestamp: Date
  sourceType: 'user_input' | 'agent_suggestion'
  isPrimary: boolean
}

export interface MessageContent {
  type: 'text'
  text?: string
  metadata?: {
    conversationId?: string
    intent?: DetectedIntent
    channel?: string
    timestamp?: string
  }
}

export type ConversationPhase =
  | 'greeting'
  | 'problem_solving'
  | 'navigation'
  | 'data_entry'
  | 'general'
  | 'handoff'

export interface AgentInfo {
  id: number | string
  agentType: string
  displayName: string
  personality?: string
  capabilities?: string[]
  responseRules?: Record<string, unknown>
}

export interface ConversationContext {
  conversationId: string
  phase: ConversationPhase
  intentHistory: DetectedIntent[]
  currentPrimaryIntent?: string
  activeBusinessGoals?: string[]
  userPreferences?: Record<string, unknown>
  sessionMemory?: Record<string, unknown>
  lastUserMessageTimestamp?: Date
  lastAgentMessageTimestamp?: Date
  agent?: AgentInfo
}
