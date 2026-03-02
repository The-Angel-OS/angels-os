/**
 * Discord Bot Bridge — Multi-Tenant Bot Manager
 *
 * Standalone script that manages N Discord.js clients — one per active
 * discord connector in the Connectors collection. Each connector represents
 * a different enterprise's Discord bot.
 *
 * ## Architecture
 *
 * BotManager → findAllConnectors('discord') → creates a Client per connector.
 * Each Client logs in with the connector's botToken, listens for messages,
 * and POSTs them to the Payload webhook endpoint.
 *
 * ## Running
 *
 * ```
 * pnpm discord
 * ```
 *
 * ## Environment
 *
 * - PAYLOAD_URL: URL of the Payload server (default: http://localhost:3000)
 * - PAYLOAD_API_KEY: Optional API key for Payload REST API
 *
 * Sprint 33 — Discord Integration · Multi-Tenant Bot Bridge
 */

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  type Message,
  type Interaction,
  type ChatInputCommandInteraction,
  Partials,
} from 'discord.js'

// ─── Configuration ───────────────────────────────────────────

const PAYLOAD_URL = process.env.PAYLOAD_URL || 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY || ''
const SYNC_INTERVAL = 60_000 // 60 seconds

// ─── Types ───────────────────────────────────────────────────

interface ConnectorDoc {
  id: string
  tenantId: string
  config: {
    botToken: string
    applicationId: string
    guildIds?: string[]
    leoChannelName?: string
    webhookSecret?: string
  }
}

interface ActiveClient {
  client: Client
  connector: ConnectorDoc
  ready: boolean
}

// ─── Slash Commands ──────────────────────────────────────────

const SLASH_COMMANDS = [
  {
    name: 'ask',
    description: 'Ask LEO anything',
    options: [
      {
        name: 'question',
        type: 3, // STRING
        required: true,
        description: 'Your question',
      },
    ],
  },
  {
    name: 'pulse',
    description: 'Check the federation pulse',
  },
  {
    name: 'weather',
    description: 'Federation weather report',
  },
]

// ─── Bot Manager ─────────────────────────────────────────────

class BotManager {
  private clients = new Map<string, ActiveClient>()
  private syncTimer: ReturnType<typeof setInterval> | null = null

  async start(): Promise<void> {
    console.log('[BotManager] Starting multi-tenant Discord bot manager...')
    console.log(`[BotManager] Payload URL: ${PAYLOAD_URL}`)

    // Initial sync
    await this.syncConnectors()

    // Periodic sync for new/removed connectors
    this.syncTimer = setInterval(() => {
      this.syncConnectors().catch((err) => {
        console.error('[BotManager] Sync error:', err)
      })
    }, SYNC_INTERVAL)

    console.log(`[BotManager] Sync interval: ${SYNC_INTERVAL / 1000}s`)
  }

  async stop(): Promise<void> {
    console.log('[BotManager] Shutting down...')

    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }

    const destroyPromises = Array.from(this.clients.keys()).map((id) =>
      this.destroyClient(id),
    )
    await Promise.allSettled(destroyPromises)

    console.log('[BotManager] All clients destroyed. Goodbye.')
  }

  async syncConnectors(): Promise<void> {
    const connectors = await this.fetchDiscordConnectors()

    const activeIds = new Set(connectors.map((c) => c.id))

    // Stop removed/disabled connectors
    for (const [id] of this.clients) {
      if (!activeIds.has(id)) {
        console.log(`[BotManager] Connector ${id} removed/disabled — destroying client`)
        await this.destroyClient(id)
      }
    }

    // Start new connectors
    for (const connector of connectors) {
      const existing = this.clients.get(connector.id)

      if (existing) {
        // Check if config changed (token or guilds)
        if (
          existing.connector.config.botToken !== connector.config.botToken ||
          JSON.stringify(existing.connector.config.guildIds) !==
            JSON.stringify(connector.config.guildIds)
        ) {
          console.log(`[BotManager] Connector ${connector.id} config changed — restarting`)
          await this.destroyClient(connector.id)
          await this.createClient(connector)
        }
      } else {
        await this.createClient(connector)
      }
    }

    console.log(`[BotManager] Active clients: ${this.clients.size}`)
  }

  private async createClient(connector: ConnectorDoc): Promise<void> {
    if (!connector.config.botToken) {
      console.warn(`[BotManager] Connector ${connector.id} has no botToken — skipping`)
      return
    }

    console.log(
      `[BotManager] Creating client for connector ${connector.id} (tenant: ${connector.tenantId})`,
    )

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel, Partials.Message],
    })

    const active: ActiveClient = {
      client,
      connector,
      ready: false,
    }

    // Wire events
    client.once('ready', async () => {
      active.ready = true
      console.log(
        `[Bot ${connector.id}] Ready as ${client.user?.tag} — serving guilds: ${connector.config.guildIds?.join(', ') || 'all'}`,
      )

      // Register slash commands
      await this.registerSlashCommands(connector)
    })

    client.on('messageCreate', async (message: Message) => {
      await this.handleMessage(message, connector)
    })

    client.on('interactionCreate', async (interaction: Interaction) => {
      if (interaction.isChatInputCommand()) {
        await this.handleSlashCommand(interaction, connector)
      }
    })

    client.on('error', (err) => {
      console.error(`[Bot ${connector.id}] Client error:`, err)
    })

    try {
      await client.login(connector.config.botToken)
      this.clients.set(connector.id, active)
    } catch (err) {
      console.error(`[Bot ${connector.id}] Failed to login:`, err)
    }
  }

  private async destroyClient(connectorId: string): Promise<void> {
    const active = this.clients.get(connectorId)
    if (active) {
      try {
        active.client.destroy()
      } catch {
        // Ignore destroy errors
      }
      this.clients.delete(connectorId)
      console.log(`[Bot ${connectorId}] Destroyed`)
    }
  }

  // ─── Message Handling ────────────────────────────────────────

  private async handleMessage(message: Message, connector: ConnectorDoc): Promise<void> {
    // Ignore bot messages
    if (message.author.bot) return

    // Check if we should respond
    if (!this.shouldRespond(message, connector)) return

    // Strip bot mention from content
    let content = message.content
    if (message.mentions.users.has(message.client.user!.id)) {
      content = content.replace(new RegExp(`<@!?${message.client.user!.id}>`, 'g'), '').trim()
    }

    if (!content) content = 'Hello'

    try {
      // Show typing indicator
      if ('sendTyping' in message.channel) {
        await (message.channel as any).sendTyping()
      }

      const response = await this.postToPayload(
        {
          type: 'message' as const,
          content,
          connectorId: connector.id,
          guildId: message.guildId,
          channelId: message.channelId,
          channelName: 'name' in message.channel ? (message.channel as any).name || 'dm' : 'dm',
          userId: message.author.id,
          userName: message.author.displayName || message.author.username,
          isDM: !message.guildId,
          messageId: message.id,
        },
        connector.config.webhookSecret,
      )

      // Split response at 2000 chars and send
      const chunks = splitResponse(response)
      for (const chunk of chunks) {
        await message.reply(chunk)
      }
    } catch (err) {
      console.error(`[Bot ${connector.id}] Error processing message:`, err)
      try {
        await message.reply('Sorry, I encountered an error. Please try again.')
      } catch {
        // Can't even reply — nothing to do
      }
    }
  }

  private async handleSlashCommand(
    interaction: ChatInputCommandInteraction,
    connector: ConnectorDoc,
  ): Promise<void> {
    await interaction.deferReply()

    const commandName = interaction.commandName
    let content = ''

    if (commandName === 'ask') {
      content = interaction.options.getString('question') || 'Hello'
    }

    try {
      const response = await this.postToPayload(
        {
          type: 'slash_command' as const,
          content,
          connectorId: connector.id,
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          channelName:
            'name' in interaction.channel! ? (interaction.channel as any).name || 'slash' : 'slash',
          userId: interaction.user.id,
          userName: interaction.user.displayName || interaction.user.username,
          isDM: !interaction.guildId,
          commandName,
        },
        connector.config.webhookSecret,
      )

      const chunks = splitResponse(response)
      await interaction.editReply(chunks[0] || 'No response.')

      // Send additional chunks as follow-ups
      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp(chunks[i])
      }
    } catch (err) {
      console.error(`[Bot ${connector.id}] Slash command error:`, err)
      await interaction.editReply('Sorry, I encountered an error. Please try again.')
    }
  }

  // ─── Should Respond Logic ────────────────────────────────────

  shouldRespond(message: Message, connector: ConnectorDoc): boolean {
    // Always respond to DMs
    if (!message.guildId) return true

    // Check if bot is mentioned
    if (message.mentions.users.has(message.client.user!.id)) return true

    // Check if message is in the configured LEO channel
    const leoChannelName = connector.config.leoChannelName || 'leo'
    if ('name' in message.channel && (message.channel as any).name === leoChannelName) {
      return true
    }

    return false
  }

  // ─── Payload Communication ───────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async postToPayload(body: any, webhookSecret?: string): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (webhookSecret) {
      headers['x-discord-secret'] = webhookSecret
    }

    if (PAYLOAD_API_KEY) {
      headers['Authorization'] = `Bearer ${PAYLOAD_API_KEY}`
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    try {
      const res = await fetch(`${PAYLOAD_URL}/api/discord/webhook`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error')
        throw new Error(`Payload returned ${res.status}: ${errText}`)
      }

      const data = (await res.json()) as { text?: string }
      return data.text || 'I received your message.'
    } finally {
      clearTimeout(timeout)
    }
  }

  // ─── Slash Command Registration ──────────────────────────────

  private async registerSlashCommands(connector: ConnectorDoc): Promise<void> {
    if (!connector.config.applicationId) {
      console.warn(
        `[Bot ${connector.id}] No applicationId — skipping slash command registration`,
      )
      return
    }

    const rest = new REST({ version: '10' }).setToken(connector.config.botToken)

    try {
      // Register per-guild if guildIds specified, otherwise global
      if (connector.config.guildIds?.length) {
        for (const guildId of connector.config.guildIds) {
          await rest.put(
            Routes.applicationGuildCommands(connector.config.applicationId, guildId),
            { body: SLASH_COMMANDS },
          )
          console.log(`[Bot ${connector.id}] Slash commands registered for guild ${guildId}`)
        }
      } else {
        await rest.put(Routes.applicationCommands(connector.config.applicationId), {
          body: SLASH_COMMANDS,
        })
        console.log(`[Bot ${connector.id}] Global slash commands registered`)
      }
    } catch (err) {
      console.error(`[Bot ${connector.id}] Failed to register slash commands:`, err)
    }
  }

  // ─── Fetch Connectors from Payload ───────────────────────────

  private async fetchDiscordConnectors(): Promise<ConnectorDoc[]> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (PAYLOAD_API_KEY) {
      headers['Authorization'] = `Bearer ${PAYLOAD_API_KEY}`
    }

    try {
      const res = await fetch(
        `${PAYLOAD_URL}/api/connectors?where[type][equals]=discord&where[enabled][equals]=true&where[status][not_equals]=error&limit=100&depth=0`,
        { headers },
      )

      if (!res.ok) {
        console.error(`[BotManager] Failed to fetch connectors: ${res.status}`)
        return []
      }

      const data = (await res.json()) as { docs?: any[] }
      return (data.docs || []).map((doc: any) => ({
        id: String(doc.id),
        tenantId: String(doc.tenant),
        config: {
          botToken: doc.config?.botToken || '',
          applicationId: doc.config?.applicationId || '',
          guildIds: doc.config?.guildIds || [],
          leoChannelName: doc.config?.leoChannelName || 'leo',
          webhookSecret: doc.config?.webhookSecret || '',
        },
      }))
    } catch (err) {
      console.error('[BotManager] Error fetching connectors:', err)
      return []
    }
  }
}

// ─── Utility Functions ───────────────────────────────────────

/**
 * Split a response into chunks that fit Discord's 2000 char limit.
 * Exported for testing.
 */
export function splitResponse(text: string, max: number = 2000): string[] {
  if (!text) return ['']
  if (text.length <= max) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= max) {
      chunks.push(remaining)
      break
    }

    // Try paragraph boundary
    let splitAt = remaining.lastIndexOf('\n\n', max)
    if (splitAt <= 0) {
      // Try line boundary
      splitAt = remaining.lastIndexOf('\n', max)
    }
    if (splitAt <= 0) {
      // Try space
      splitAt = remaining.lastIndexOf(' ', max)
    }
    if (splitAt <= 0) {
      // Hard split
      splitAt = max
    }

    chunks.push(remaining.substring(0, splitAt).trim())
    remaining = remaining.substring(splitAt).trim()
  }

  return chunks.filter((c) => c.length > 0)
}

/**
 * Determine if the bot should respond to a message.
 * Exported for testing.
 */
export function shouldRespond(
  isDM: boolean,
  isMentioned: boolean,
  channelName: string,
  leoChannelName: string = 'leo',
): boolean {
  if (isDM) return true
  if (isMentioned) return true
  if (channelName === leoChannelName) return true
  return false
}

/**
 * Build the webhook request payload.
 * Exported for testing.
 */
export function buildPayload(opts: {
  type: 'message' | 'slash_command'
  content: string
  connectorId: string
  guildId: string | null
  channelId: string
  channelName: string
  userId: string
  userName: string
  isDM: boolean
  commandName?: string
  messageId?: string
}) {
  return { ...opts }
}

// ─── Main ────────────────────────────────────────────────────

const manager = new BotManager()

// Graceful shutdown
process.on('SIGINT', async () => {
  await manager.stop()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await manager.stop()
  process.exit(0)
})

manager.start().catch((err) => {
  console.error('[BotManager] Fatal startup error:', err)
  process.exit(1)
})
