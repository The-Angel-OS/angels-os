/**
 * Conversation Engine – manages flow and state of LEO conversations.
 * Uses context and intents to guide interactions and decision-making.
 *
 * @see https://github.com/The-Angel-OS/angel-os/blob/main/src/utilities/ConversationEngine.ts
 *
 * TODOs:
 * - Explicit intent handling (NLU integration)
 * - State transitions (state machine)
 * - Integration with NLU/NLG services
 * - Managing conversation history and memory more effectively
 */
import type { ConversationContext, DetectedIntent, MessageContent } from '@/types/conversation'

interface ConversationTurn {
  turnId: string
  userInput?: MessageContent
  agentResponse?: MessageContent
  timestamp: Date
  intentsDetected?: DetectedIntent[]
}

export class ConversationEngine {
  private context: ConversationContext

  constructor(initialContext?: Partial<ConversationContext>) {
    this.context = {
      conversationId: initialContext?.conversationId ?? `conv_${Date.now()}`,
      phase: initialContext?.phase ?? 'greeting',
      intentHistory: initialContext?.intentHistory ?? [],
      activeBusinessGoals: initialContext?.activeBusinessGoals ?? [],
      userPreferences: initialContext?.userPreferences ?? {},
      sessionMemory: initialContext?.sessionMemory ?? {},
      ...initialContext,
    }
  }

  /**
   * Process incoming message and update conversation state.
   * @returns Response message content (from LEO) or null.
   */
  public async handleIncomingMessage(message: MessageContent): Promise<MessageContent | null> {
    if (message.metadata?.intent) {
      this.context.intentHistory.push(message.metadata.intent)
      this.context.currentPrimaryIntent = message.metadata.intent.name
    }
    this.context.lastUserMessageTimestamp = new Date()

    const nextAction = this.determineNextAction(message)

    if (nextAction === 'generate_ai_response') {
      const aiResponse = await this.generatePlaceholderResponse(message)
      if (aiResponse.metadata?.intent) {
        this.context.intentHistory.push(aiResponse.metadata.intent)
      }
      this.context.lastAgentMessageTimestamp = new Date()
      return aiResponse
    }

    return null
  }

  private determineNextAction(message: MessageContent): string {
    const text = (message.text ?? '').toLowerCase()
    if (
      text.includes('help') ||
      message.metadata?.intent?.name === 'request_assistance'
    ) {
      this.context.phase = 'problem_solving'
      return 'generate_ai_response'
    }
    if (text.includes('go to') || text.includes('navigate') || text.includes('take me')) {
      this.context.phase = 'navigation'
      return 'generate_ai_response'
    }
    if (
      text.includes('post') ||
      text.includes('product') ||
      text.includes('show me') ||
      text.includes('list') ||
      text.includes('find')
    ) {
      this.context.phase = 'data_entry'
      return 'generate_ai_response'
    }
    return 'generate_ai_response'
  }

  private async generatePlaceholderResponse(original: MessageContent): Promise<MessageContent> {
    const payload = this.context.sessionMemory?.payload as import('payload').Payload | undefined
    const agent = this.context.agent
    const agentName = agent?.displayName ?? 'LEO'
    const text = (original.text ?? '').toLowerCase()
    let responseText: string

    // Check agent capabilities before performing actions
    const capabilities = agent?.capabilities ?? ['query_posts', 'query_products', 'manage_spaces']

    if (payload) {
      if ((text.includes('post') || text.includes('posts')) && capabilities.includes('query_posts')) {
        const result = await payload.find({
          collection: 'posts',
          limit: 5,
          depth: 0,
          overrideAccess: true,
          where: { _status: { equals: 'published' } },
          sort: '-publishedOn',
          select: { title: true, slug: true },
        })
        const posts = result.docs ?? []
        responseText =
          posts.length > 0
            ? `${agentName}: Here are recent posts:\n${posts.map((p) => `- ${p.title} (/posts/${p.slug})`).join('\n')}`
            : `${agentName}: No published posts yet. Check back soon!`
      } else if ((text.includes('product') || text.includes('products')) && capabilities.includes('query_products')) {
        const result = await payload.find({
          collection: 'products',
          limit: 5,
          depth: 0,
          overrideAccess: true,
          where: { _status: { equals: 'published' } },
          sort: '-updatedAt',
          select: { title: true, slug: true },
        })
        const products = result.docs ?? []
        responseText =
          products.length > 0
            ? `${agentName}: Here are products:\n${products.map((p) => `- ${p.title} (/products/${p.slug})`).join('\n')}`
            : `${agentName}: No products yet.`
      } else if (!capabilities.includes('query_posts') && !capabilities.includes('query_products')) {
        // Agent doesn't have capability for this request
        responseText = `${agentName}: I'm not able to help with that. ${agent?.personality ? agent.personality : 'Let me know if there\'s something else I can assist with.'}`
      } else {
        // Apply personality if available
        const personalityHint = agent?.personality ? `\n\n(${agent.personality})` : ''
        responseText = `${agentName}: I received "${original.text ?? 'your message'}". I can help with posts, products, navigation, or general assistance. What would you like?${personalityHint}`
      }
    } else {
      responseText = `${agentName}: I received "${original.text ?? 'your message'}". How can I assist you?`
    }
    return {
      type: 'text',
      text: responseText,
      metadata: {
        conversationId: this.context.conversationId,
        intent: {
          intentId: `intent_${Date.now()}`,
          name: 'provide_assistance_offer',
          confidence: 0.9,
          entities: [],
          timestamp: new Date(),
          sourceType: 'agent_suggestion',
          isPrimary: true,
        },
      },
    }
  }

  public getCurrentContext(): ConversationContext {
    return { ...this.context }
  }

  public updateContext(updates: Partial<ConversationContext>): void {
    this.context = { ...this.context, ...updates }
  }
}
