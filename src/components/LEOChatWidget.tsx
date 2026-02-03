'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, MessageCircle, Send, Minimize2, Maximize2 } from 'lucide-react'

export interface LEOMessage {
  id: string
  role: 'user' | 'leo' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    agentName?: string
    agentType?: string
    conversationId?: string
    needsHumanInput?: boolean
  }
}

export interface LEOChatConfig {
  tenantSlug: string
  apiEndpoint?: string
  agentName?: string
  initialMessage?: string
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  theme?: 'light' | 'dark' | 'auto'
  allowAnonymous?: boolean
  requireEmail?: boolean
  customStyles?: React.CSSProperties
  onConversationStart?: (conversationId: string) => void
  onMessageSent?: (message: LEOMessage) => void
  onAuthRequired?: () => void
}

/**
 * Embeddable LEO Chat Widget for Angel OS
 * Can be embedded on any website to provide AI assistance
 * Handles anonymous → authenticated transitions gracefully
 */
export const LEOChatWidget: React.FC<LEOChatConfig> = ({
  tenantSlug,
  apiEndpoint = '/api/mcp',
  agentName = 'LEO',
  initialMessage = 'Hello! I\'m LEO, your AI assistant. How can I help you today?',
  position = 'bottom-right',
  theme = 'auto',
  allowAnonymous = true,
  requireEmail = false,
  customStyles = {},
  onConversationStart,
  onMessageSent,
  onAuthRequired
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<LEOMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showEmailCapture, setShowEmailCapture] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Initialize conversation on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      initializeConversation()
    }
  }, [isOpen])

  const initializeConversation = async () => {
    const welcomeMessage: LEOMessage = {
      id: `msg_${Date.now()}`,
      role: 'leo',
      content: initialMessage,
      timestamp: new Date(),
      metadata: {
        agentName,
        agentType: 'leo'
      }
    }

    setMessages([welcomeMessage])

    // Generate conversation ID
    const newConversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setConversationId(newConversationId)
    
    if (onConversationStart) {
      onConversationStart(newConversationId)
    }
  }

  const sendMessage = async (content: string, email?: string) => {
    if (!content.trim()) return

    const userMessage: LEOMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    if (onMessageSent) {
      onMessageSent(userMessage)
    }

    try {
      // Build request payload
      const requestPayload = {
        message: content,
        conversationId,
        tenantSlug,
        userEmail: email || userEmail || undefined,
        isAnonymous: !isAuthenticated && !email,
        metadata: {
          source: 'chat_widget',
          position,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Slug': tenantSlug,
        },
        body: JSON.stringify({
          tool: 'leo_respond',
          args: requestPayload
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      // Handle different response types
      if (result.requiresAuth && !isAuthenticated) {
        if (requireEmail && !email && !userEmail) {
          setShowEmailCapture(true)
        } else if (onAuthRequired) {
          onAuthRequired()
        } else {
          // Show auth suggestion message
          const authMessage: LEOMessage = {
            id: `msg_${Date.now()}`,
            role: 'system',
            content: 'For a better experience, consider signing in or providing your email address.',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, authMessage])
        }
      }

      // Add LEO's response
      const leoMessage: LEOMessage = {
        id: `msg_${Date.now()}`,
        role: 'leo',
        content: result.response || result.text || 'I\'m here to help, but I didn\'t understand that. Could you try rephrasing?',
        timestamp: new Date(),
        metadata: {
          agentName: result.agentName || agentName,
          agentType: result.agentType || 'leo',
          conversationId: result.conversationId || conversationId,
          needsHumanInput: result.needsHumanInput
        }
      }

      setMessages(prev => [...prev, leoMessage])

      // Update conversation ID if provided
      if (result.conversationId && result.conversationId !== conversationId) {
        setConversationId(result.conversationId)
      }

      // Handle email capture
      if (email) {
        setUserEmail(email)
        setIsAuthenticated(true)
        setShowEmailCapture(false)
      }

    } catch (error) {
      console.error('LEO Chat Widget Error:', error)
      
      const errorMessage: LEOMessage = {
        id: `msg_${Date.now()}`,
        role: 'system',
        content: 'Sorry, I\'m having trouble connecting right now. Please try again in a moment.',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoading && inputValue.trim()) {
      sendMessage(inputValue)
    }
  }

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const email = (e.target as any).email.value
    if (email) {
      sendMessage(inputValue, email)
    }
  }

  const getPositionStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      position: 'fixed',
      zIndex: 1000,
      ...customStyles
    }

    switch (position) {
      case 'bottom-right':
        return { ...baseStyles, bottom: '20px', right: '20px' }
      case 'bottom-left':
        return { ...baseStyles, bottom: '20px', left: '20px' }
      case 'top-right':
        return { ...baseStyles, top: '20px', right: '20px' }
      case 'top-left':
        return { ...baseStyles, top: '20px', left: '20px' }
      default:
        return { ...baseStyles, bottom: '20px', right: '20px' }
    }
  }

  const getThemeStyles = () => {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = theme === 'dark' || (theme === 'auto' && systemPrefersDark)

    return {
      background: isDark ? '#1f2937' : '#ffffff',
      border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
      color: isDark ? '#f9fafb' : '#111827',
      inputBg: isDark ? '#374151' : '#f9fafb',
      inputBorder: isDark ? '#4b5563' : '#d1d5db',
      buttonBg: isDark ? '#3b82f6' : '#2563eb',
      buttonHover: isDark ? '#2563eb' : '#1d4ed8'
    }
  }

  const themeStyles = getThemeStyles()

  if (!isOpen) {
    return (
      <div style={getPositionStyles()}>
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: themeStyles.buttonBg,
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={e => (e.currentTarget.style.background = themeStyles.buttonHover)}
          onMouseOut={e => (e.currentTarget.style.background = themeStyles.buttonBg)}
          title={`Chat with ${agentName}`}
        >
          <MessageCircle size={24} />
        </button>
      </div>
    )
  }

  return (
    <div style={getPositionStyles()}>
      <div
        style={{
          width: isMinimized ? '300px' : '400px',
          height: isMinimized ? '60px' : '600px',
          background: themeStyles.background,
          border: themeStyles.border,
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px',
            background: themeStyles.buttonBg,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: '60px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              LEO
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '14px' }}>{agentName}</div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>
                {isAuthenticated ? 'Signed in' : 'Anonymous chat'}
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div
              style={{
                flex: 1,
                padding: '16px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '80%',
                      padding: '8px 12px',
                      borderRadius: '12px',
                      background: message.role === 'user' 
                        ? themeStyles.buttonBg 
                        : message.role === 'system'
                        ? 'rgba(156, 163, 175, 0.1)'
                        : 'rgba(156, 163, 175, 0.1)',
                      color: message.role === 'user' ? 'white' : themeStyles.color,
                      fontSize: '14px',
                      lineHeight: '1.4'
                    }}
                  >
                    {message.metadata?.agentName && message.role === 'leo' && (
                      <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>
                        {message.metadata.agentName}
                      </div>
                    )}
                    {message.content}
                    {message.metadata?.needsHumanInput && (
                      <div style={{ 
                        fontSize: '12px', 
                        marginTop: '8px', 
                        padding: '4px 8px', 
                        background: 'rgba(245, 101, 101, 0.1)',
                        borderRadius: '6px',
                        border: '1px solid rgba(245, 101, 101, 0.3)'
                      }}>
                        🚨 This conversation needs human attention
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '12px',
                      background: 'rgba(156, 163, 175, 0.1)',
                      color: themeStyles.color,
                      fontSize: '14px'
                    }}
                  >
                    {agentName} is thinking...
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Email Capture Modal */}
            {showEmailCapture && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10
                }}
              >
                <form
                  onSubmit={handleEmailSubmit}
                  style={{
                    background: themeStyles.background,
                    padding: '24px',
                    borderRadius: '12px',
                    minWidth: '280px'
                  }}
                >
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: themeStyles.color }}>
                    Better Experience Ahead
                  </h3>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: themeStyles.color, opacity: 0.8 }}>
                    Providing your email helps me give you more personalized assistance and remember our conversation.
                  </p>
                  <input
                    type="email"
                    name="email"
                    placeholder="your@email.com"
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${themeStyles.inputBorder}`,
                      background: themeStyles.inputBg,
                      color: themeStyles.color,
                      fontSize: '14px',
                      marginBottom: '16px'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="submit"
                      style={{
                        flex: 1,
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        background: themeStyles.buttonBg,
                        color: 'white',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmailCapture(false)
                        sendMessage(inputValue)
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: `1px solid ${themeStyles.inputBorder}`,
                        background: themeStyles.inputBg,
                        color: themeStyles.color,
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      Skip
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              style={{
                padding: '16px',
                borderTop: `1px solid ${themeStyles.inputBorder}`,
                display: 'flex',
                gap: '8px'
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Message ${agentName}...`}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '20px',
                  border: `1px solid ${themeStyles.inputBorder}`,
                  background: themeStyles.inputBg,
                  color: themeStyles.color,
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: 'none',
                  background: inputValue.trim() ? themeStyles.buttonBg : themeStyles.inputBorder,
                  color: 'white',
                  cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default LEOChatWidget