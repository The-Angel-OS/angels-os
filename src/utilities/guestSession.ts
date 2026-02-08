/**
 * Guest Session Management Utility
 * Handles localStorage persistence and API interactions for guest chat sessions
 */

export interface GuestSessionData {
  sessionId: string
  tenantId: string
  spaceId?: string
  createdAt: string
  lastActive: string
}

const GUEST_SESSION_KEY = 'angel-os-guest-session'

/**
 * Generate a unique guest session ID
 */
export function generateGuestSessionId(): string {
  return `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get or create a guest session from localStorage
 */
export function getOrCreateGuestSession(tenantId: string, spaceId?: string): GuestSessionData {
  try {
    const stored = localStorage.getItem(GUEST_SESSION_KEY)
    if (stored) {
      const session: GuestSessionData = JSON.parse(stored)
      // Update last active timestamp
      session.lastActive = new Date().toISOString()
      localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session))
      return session
    }
  } catch (error) {
    console.warn('Failed to parse stored guest session:', error)
  }

  // Create new guest session
  const newSession: GuestSessionData = {
    sessionId: generateGuestSessionId(),
    tenantId,
    spaceId,
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString()
  }

  localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(newSession))
  return newSession
}

/**
 * Update guest session activity timestamp
 */
export function updateGuestSessionActivity(): void {
  try {
    const stored = localStorage.getItem(GUEST_SESSION_KEY)
    if (stored) {
      const session: GuestSessionData = JSON.parse(stored)
      session.lastActive = new Date().toISOString()
      localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session))
    }
  } catch (error) {
    console.warn('Failed to update guest session activity:', error)
  }
}

/**
 * Clear guest session from localStorage (after promotion)
 */
export function clearGuestSession(): void {
  localStorage.removeItem(GUEST_SESSION_KEY)
}

/**
 * Create guest session in database using existing WebChatSessions
 */
export async function createGuestSessionInDB(sessionData: GuestSessionData): Promise<boolean> {
  try {
    const response = await fetch('/api/web-chat-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorInfo: {
          userAgent: navigator.userAgent,
          sessionId: sessionData.sessionId,
          createdAt: sessionData.createdAt
        },
        space: sessionData.spaceId,
        tenant: sessionData.tenantId
      })
    })

    return response.ok
  } catch (error) {
    console.error('Failed to create guest session in database:', error)
    return false
  }
}

/**
 * Promote guest session to user PM channel
 */
export async function promoteGuestSession(userId: string, tenantId: string): Promise<{
  success: boolean
  pmChannelId?: string
  error?: string
}> {
  try {
    const guestSession = getOrCreateGuestSession(tenantId)
    
    const response = await fetch('/api/chat/promote-guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestSessionId: guestSession.sessionId,
        userId,
        tenantId
      })
    })

    const result = await response.json()

    if (response.ok && result.success) {
      // Clear guest session after successful promotion
      clearGuestSession()
      return {
        success: true,
        pmChannelId: result.pmChannelId
      }
    } else {
      return {
        success: false,
        error: result.error || 'Failed to promote guest session'
      }
    }
  } catch (error) {
    console.error('Error promoting guest session:', error)
    return {
      success: false,
      error: 'Network error during promotion'
    }
  }
}

/**
 * Check if user is in guest mode
 */
export function isGuestMode(): boolean {
  return localStorage.getItem(GUEST_SESSION_KEY) !== null
}

/**
 * Get current guest session ID (if any)
 */
export function getCurrentGuestSessionId(): string | null {
  try {
    const stored = localStorage.getItem(GUEST_SESSION_KEY)
    if (stored) {
      const session: GuestSessionData = JSON.parse(stored)
      return session.sessionId
    }
  } catch (error) {
    console.warn('Failed to get guest session ID:', error)
  }
  return null
}
