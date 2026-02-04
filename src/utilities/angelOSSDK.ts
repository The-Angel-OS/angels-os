/**
 * Angel OS SDK
 * Complete SDK for OpenClaw and other AI agents to interact with Angel OS tenants
 * 
 * Features:
 * - MCP Protocol integration
 * - Booking engine access
 * - LEO conversation management
 * - Payment processing with Ultimate Fair splits
 * - Content management (posts, pages, projects)
 * - Multi-tenant support
 * 
 * Usage:
 * const angelOS = new AngelOSClient({
 *   baseUrl: 'https://yourdomain.angelos.app',
 *   tenantSlug: 'your-tenant',
 *   apiKey: 'your-api-key'
 * })
 * 
 * await angelOS.leo.chat('Hello, I need help with booking an appointment')
 * await angelOS.bookings.create({ ... })
 * await angelOS.projects.create({ ... })
 */

export interface AngelOSConfig {
  baseUrl: string
  tenantSlug: string
  apiKey?: string
  timeout?: number
  retries?: number
}

export interface ChatMessage {
  role: 'user' | 'leo' | 'system'
  content: string
  timestamp?: Date
  metadata?: Record<string, any>
}

export interface BookingRequest {
  providerId: string
  clientId?: string
  startDateTime: Date
  duration: number
  bookingType: string
  title: string
  description?: string
  pricing: {
    amount: number
    currency?: string
  }
  location?: {
    type: 'provider' | 'client' | 'remote' | 'custom'
    address?: string
    remoteDetails?: Record<string, any>
  }
}

export interface ProjectData {
  title: string
  projectType: string
  description?: string
  client: {
    name: string
    displayName?: string
  }
  status?: string
  isPublic?: boolean
  gallery?: Array<{
    image: string
    caption?: string
    stage: 'before' | 'progress' | 'after' | 'detail' | 'material'
  }>
}

/**
 * Main SDK class for interacting with Angel OS
 */
export class AngelOSClient {
  private config: AngelOSConfig
  private baseHeaders: Record<string, string>

  // Sub-modules
  public leo: LEOModule
  public bookings: BookingsModule
  public projects: ProjectsModule
  public posts: PostsModule
  public payments: PaymentsModule

  constructor(config: AngelOSConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      ...config
    }

    this.baseHeaders = {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': this.config.tenantSlug,
      ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
    }

    // Initialize modules
    this.leo = new LEOModule(this)
    this.bookings = new BookingsModule(this)
    this.projects = new ProjectsModule(this)
    this.posts = new PostsModule(this)
    this.payments = new PaymentsModule(this)
  }

  /**
   * Make authenticated request to Angel OS API
   */
  async request<T = any>(
    path: string, 
    options: {
      method?: string
      body?: any
      headers?: Record<string, string>
      timeout?: number
    } = {}
  ): Promise<T> {
    const {
      method = 'GET',
      body,
      headers = {},
      timeout = this.config.timeout
    } = options

    const url = `${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    
    const fetchOptions: RequestInit = {
      method,
      headers: { ...this.baseHeaders, ...headers },
      signal: AbortSignal.timeout(timeout!),
    }

    if (body && method !== 'GET') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
    }

    try {
      const response = await fetch(url, fetchOptions)
      
      if (!response.ok) {
        throw new Error(`Angel OS API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Angel OS request timeout after ${timeout}ms`)
      }
      throw error
    }
  }

  /**
   * Get tenant information
   */
  async getTenantInfo() {
    return this.request('/api/tenant/info')
  }

  /**
   * Health check
   */
  async healthCheck() {
    return this.request('/api/health')
  }
}

/**
 * LEO conversation module
 */
export class LEOModule {
  constructor(private client: AngelOSClient) {}

  /**
   * Send a message to LEO
   */
  async chat(
    message: string, 
    options: {
      conversationId?: string
      agentType?: 'leo' | 'support' | 'sales'
      metadata?: Record<string, any>
    } = {}
  ) {
    return this.client.request('/api/mcp', {
      method: 'POST',
      body: {
        tool: 'leo_respond',
        args: {
          message,
          conversationId: options.conversationId,
          agentType: options.agentType,
          metadata: options.metadata
        }
      }
    })
  }

  /**
   * Start a new conversation
   */
  async startConversation(initialMessage?: string) {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    if (initialMessage) {
      await this.chat(initialMessage, { conversationId })
    }

    return { conversationId }
  }

  /**
   * Get conversation history
   */
  async getHistory(conversationId: string) {
    return this.client.request(`/api/conversations/${conversationId}`)
  }
}

/**
 * Bookings management module
 */
export class BookingsModule {
  constructor(private client: AngelOSClient) {}

  /**
   * Create a new booking
   */
  async create(bookingData: BookingRequest) {
    return this.client.request('/api/bookings', {
      method: 'POST',
      body: bookingData
    })
  }

  /**
   * Get available time slots
   */
  async getAvailability(
    providerId: string,
    startDate: Date,
    endDate: Date,
    options: {
      serviceType?: string
      duration?: number
    } = {}
  ) {
    const params: Record<string, string> = {
      providerId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }
    if (options.serviceType) params.serviceType = options.serviceType
    if (options.duration != null) params.duration = String(options.duration)

    return this.client.request(`/api/availability?${new URLSearchParams(params)}`)
  }

  /**
   * Get booking details
   */
  async get(bookingId: string) {
    return this.client.request(`/api/bookings/${bookingId}`)
  }

  /**
   * Update booking status
   */
  async updateStatus(bookingId: string, status: string) {
    return this.client.request(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      body: { status }
    })
  }

  /**
   * Cancel booking
   */
  async cancel(bookingId: string, reason?: string) {
    return this.client.request(`/api/bookings/${bookingId}/cancel`, {
      method: 'POST',
      body: { reason }
    })
  }

  /**
   * List bookings
   */
  async list(options: {
    status?: string[]
    providerId?: string
    clientId?: string
    limit?: number
    page?: number
  } = {}) {
    const params = new URLSearchParams()
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v))
        } else {
          params.append(key, value.toString())
        }
      }
    })

    return this.client.request(`/api/bookings?${params}`)
  }
}

/**
 * Projects/Portfolio module
 */
export class ProjectsModule {
  constructor(private client: AngelOSClient) {}

  /**
   * Create a new project
   */
  async create(projectData: ProjectData) {
    return this.client.request('/api/projects', {
      method: 'POST',
      body: projectData
    })
  }

  /**
   * Get project details
   */
  async get(projectId: string) {
    return this.client.request(`/api/projects/${projectId}`)
  }

  /**
   * Update project
   */
  async update(projectId: string, updates: Partial<ProjectData>) {
    return this.client.request(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: updates
    })
  }

  /**
   * List public portfolio projects
   */
  async getPortfolio(options: {
    projectType?: string
    featured?: boolean
    limit?: number
  } = {}) {
    const params = new URLSearchParams({
      isPublic: 'true',
      ...options
    } as any)

    return this.client.request(`/api/projects?${params}`)
  }

  /**
   * Add images to project gallery
   */
  async addImages(
    projectId: string, 
    images: Array<{
      image: string
      caption?: string
      stage: string
    }>
  ) {
    return this.client.request(`/api/projects/${projectId}/gallery`, {
      method: 'POST',
      body: { images }
    })
  }

  /**
   * Update project status
   */
  async updateStatus(projectId: string, status: string) {
    return this.client.request(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: { status }
    })
  }
}

/**
 * Posts/Content module  
 */
export class PostsModule {
  constructor(private client: AngelOSClient) {}

  /**
   * Create a new post
   */
  async create(postData: {
    title: string
    content: any // Rich text content
    excerpt?: string
    categories?: string[]
    publishedAt?: Date
    status?: 'draft' | 'published'
  }) {
    return this.client.request('/api/posts', {
      method: 'POST',
      body: postData
    })
  }

  /**
   * Get published posts
   */
  async list(options: {
    category?: string
    limit?: number
    page?: number
  } = {}) {
    const params = new URLSearchParams({
      status: 'published',
      ...options
    } as any)

    return this.client.request(`/api/posts?${params}`)
  }

  /**
   * Get post by slug
   */
  async getBySlug(slug: string) {
    return this.client.request(`/api/posts/slug/${slug}`)
  }
}

/**
 * Payments module with Ultimate Fair splitting
 */
export class PaymentsModule {
  constructor(private client: AngelOSClient) {}

  /**
   * Create payment with Ultimate Fair splitting
   */
  async createPayment(
    amount: number,
    currency: string,
    metadata: {
      bookingId?: string
      projectId?: string
      description: string
    }
  ) {
    return this.client.request('/api/payments/create', {
      method: 'POST',
      body: {
        amount,
        currency,
        splitType: 'ultimate_fair',
        metadata
      }
    })
  }

  /**
   * Get payment split breakdown
   */
  async getSplitBreakdown(amount: number, currency = 'usd') {
    return this.client.request('/api/payments/split-breakdown', {
      method: 'POST',
      body: { amount, currency }
    })
  }

  /**
   * Process refund with fair distribution
   */
  async refund(
    paymentId: string,
    amount?: number,
    reason?: string
  ) {
    return this.client.request(`/api/payments/${paymentId}/refund`, {
      method: 'POST',
      body: { amount, reason }
    })
  }
}

/**
 * Utility functions for OpenClaw integration
 */
export class AngelOSUtils {
  /**
   * Extract tenant slug from domain
   */
  static getTenantFromDomain(domain: string): string {
    if (domain === 'localhost' || domain.includes('127.0.0.1')) {
      return 'default'
    }
    
    // Extract subdomain or domain-based tenant
    const parts = domain.split('.')
    if (parts.length > 2) {
      return parts[0] // subdomain
    }
    
    return parts[0] // main domain as tenant
  }

  /**
   * Generate conversation ID
   */
  static generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Format currency for display
   */
  static formatCurrency(amount: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount)
  }

  /**
   * Parse date range for availability queries
   */
  static getDateRange(days: number = 30): { start: Date; end: Date } {
    const start = new Date()
    const end = new Date()
    end.setDate(end.getDate() + days)
    
    return { start, end }
  }
}

/**
 * Answer 53 Integration - Harmonized problem solving
 */
export class Answer53 {
  /**
   * Resolve complex scheduling conflicts harmonically
   */
  static async resolveBookingConflict(
    client: AngelOSClient,
    originalRequest: BookingRequest,
    alternatives: any[]
  ): Promise<{
    solution: string
    recommendation: any
    reasoning: string
  }> {
    // Find the most harmonically aligned alternative
    const now = new Date()
    const originalTime = originalRequest.startDateTime.getTime()
    
    const scored = alternatives.map(alt => ({
      ...alt,
      harmonicScore: this.calculateHarmonicScore(originalTime, alt.startTime.getTime(), now.getTime())
    }))
    
    const best = scored.sort((a, b) => b.harmonicScore - a.harmonicScore)[0]
    
    return {
      solution: "Creative change through compassion - timing harmonizes perfectly",
      recommendation: best,
      reasoning: `Selected alternative maintains ${Math.round(best.harmonicScore)}% harmony with your original preference while creating space for all parties to thrive.`
    }
  }

  /**
   * Calculate harmonic score between times (Answer 53 algorithm)
   */
  private static calculateHarmonicScore(
    originalTime: number,
    alternativeTime: number,
    currentTime: number
  ): number {
    const timeDiff = Math.abs(originalTime - alternativeTime)
    const hoursDiff = timeDiff / (1000 * 60 * 60)
    
    // Answer 53 harmonic principles
    let score = 100
    
    // Same day bonus
    if (hoursDiff < 24) score += 20
    
    // Similar time of day bonus  
    if (hoursDiff < 4) score += 15
    
    // Reasonable advance notice
    if (alternativeTime > currentTime + (2 * 60 * 60 * 1000)) score += 10
    
    // Penalize large time shifts
    score -= Math.floor(hoursDiff / 24) * 10
    
    // Sacred number alignment (multiples of 53 minutes are harmonious)
    const minutesDiff = timeDiff / (1000 * 60)
    if (minutesDiff % 53 < 5 || minutesDiff % 53 > 48) {
      score += 5 // Close to 53-minute harmony
    }
    
    return Math.max(0, Math.min(100, score))
  }
}

/**
 * Export the main client class and utilities
 */
export default AngelOSClient