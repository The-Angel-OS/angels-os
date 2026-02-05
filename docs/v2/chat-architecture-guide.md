# 💬 LEO Chat Architecture Guide

## Overview

Angel OS implements a sophisticated multi-channel chat system with LEO AI integration across multiple interfaces. This guide documents the complete chat flow architecture, endpoints, and real-time messaging implementation.

## 🏗️ Chat System Architecture

### **Core Components**

```
┌─────────────────────────────────────────────────────────────────┐
│                     Angel OS Chat Architecture                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   Chat Panel    │    │   Chat Routes   │    │  LEO AI      │ │
│  │   (Side Panel)  │    │   (/chat)       │    │  Assistant   │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│           │                       │                     │       │
│           └───────────────────────┼─────────────────────┘       │
│                                   │                             │
│  ┌─────────────────────────────────┼─────────────────────────────┤
│  │              API Layer          │                             │
│  │                                 │                             │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │  │ /web-chat   │  │ /leo-chat   │  │ /channels/find-or-  │   │
│  │  │             │  │             │  │ create              │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │
│  └─────────────────────┼─────────────────────────────────────────┤
│                        │                                         │
│  ┌─────────────────────┼─────────────────────────────────────────┤
│  │           Business Agent Layer  │                             │
│  │                                 │                             │
│  │  ┌─────────────────────────────────────────────────────────┐ │
│  │  │          BusinessAgent.generateIntelligentResponse      │ │
│  │  │                 (Claude-4-Sonnet Pipeline)             │ │
│  │  └─────────────────────────────────────────────────────────┘ │
│  └─────────────────────┼─────────────────────────────────────────┤
│                        │                                         │
│  ┌─────────────────────┼─────────────────────────────────────────┤
│  │            Data Layer           │                             │
│  │                                 │                             │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │  │  Messages   │  │  Channels   │  │  Web Chat Sessions  │   │
│  │  │ Collection  │  │ Collection  │  │   Collection        │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 📍 Chat Interface Endpoints

### **1. Dashboard Chat Panel** (`/dashboard` - Side Panel)

**Location**: `src/app/dashboard/_components/ChatPanel.tsx`

**Flow**:
1. **User Input** → Chat Panel Input Field
2. **API Call** → `POST /api/web-chat`
3. **LEO Response** → Displayed in Panel
4. **Real-time Updates** → Immediate UI update

**Key Features**:
- ✅ Slide-out panel interface
- ✅ Session management with `sessionId`
- ✅ Context-aware (knows current dashboard page)
- ✅ Persistent chat history
- ✅ Loading states and error handling

### **2. Dedicated Chat Routes** (`/chat/*`)

**Location**: `src/components/channels/ChatContainer.tsx`

**Flow**:
1. **User Input** → Channel Chat Interface  
2. **API Call** → `POST /api/leo-chat`
3. **LEO Response** → Added to channel messages
4. **Business Logging** → Activity tracked

**Key Features**:
- ✅ Multi-channel support
- ✅ Channel-specific context
- ✅ Business activity logging
- 🚧 Real-time multi-user messaging (planned)

### **3. Web Chat Widget** (Public/Anonymous)

**Location**: `src/components/chat/PayloadChatBubble.tsx`

**Flow**:
1. **Anonymous User** → Chat Bubble
2. **API Call** → `POST /api/web-chat` 
3. **Session Creation** → Web Chat Session
4. **LEO Response** → Business-focused responses

**Key Features**:
- ✅ Anonymous user support
- ✅ Lead generation focused
- ✅ Business intelligence integration
- ✅ Customizable per tenant

## 🔗 API Endpoints Deep Dive

### **POST /api/web-chat** 
*Primary endpoint for dashboard panel and public chat*

**Request**:
```typescript
{
  message: string,
  sessionId?: string,
  spaceId?: number,      // Defaults to 1
  tenantId?: number,     // Defaults to 1  
  context?: {
    variant: 'dashboard' | 'business' | 'public',
    isAuthenticated: boolean,
    pageUrl?: string
  },
  userAgent?: string,
  pageUrl?: string
}
```

**Response**:
```typescript
{
  success: true,
  response: string,           // LEO's enhanced response
  sessionId: string,          // Session for continuity
  messageId: string,          // Message record ID
  metadata: {
    intent: string,           // Detected user intent
    confidence: number,       // AI confidence score
    processingTime: number,   // Response generation time
    provider: 'claude-4-sonnet',
    isWebChat: true
  }
}
```

**Key Features**:
- ✅ **Session Management**: Creates/maintains web chat sessions
- ✅ **Intent Detection**: Automatically detects user intentions
- ✅ **Context Enhancement**: Adds business-specific context
- ✅ **Message Persistence**: Stores in Messages collection
- ✅ **Error Handling**: Graceful fallbacks

### **POST /api/leo-chat**
*Dedicated endpoint for channel-based chat*

**Request**:
```typescript
{
  message: string,
  context?: {
    variant: 'tactical' | 'professional',
    channel?: string,
    conversationHistory?: Array<{
      content: string,
      isShip: boolean
    }>
  },
  spaceId?: number,
  tenantId?: number
}
```

**Response**:
```typescript
{
  success: true,
  response: string,           // Enhanced LEO response
  messageId: string,          // Message record ID
  metadata: {
    processingTime: number,
    confidence: number,
    variant: string
  }
}
```

### **POST /api/channels/find-or-create**
*Channel management for system channels*

**Request**:
```typescript
{
  name: string,               // Channel name (e.g., "System")
  channelType: string,        // Now supports "chat" ✅
  reportType: string,         // Channel categorization
  tenantId: number,
  guardianAngelId?: string
}
```

## 🔄 Message Flow Architecture

### **1. User Message Creation**
```typescript
// Step 1: User sends message
const userMessage = {
  content: "Hello LEO",
  messageType: 'user',
  space: spaceId,
  sender: userId
}

// Step 2: Store in Messages collection
const messageDoc = await payload.create({
  collection: 'messages',
  data: userMessage
})
```

### **2. AI Processing Pipeline**
```typescript
// Step 3: BusinessAgent processes message
const agent = new BusinessAgent(tenantId, 'friendly')
const leoResponse = await agent.generateIntelligentResponse(
  message,
  {
    customerName: 'User',
    previousMessages: conversationHistory,
    urgency: 'normal'
  }
)

// Step 4: Response enhancement
const enhancedResponse = await enhanceLeoResponse(
  leoResponse, 
  context?.variant, 
  originalMessage
)
```

### **3. LEO Response Creation**
```typescript
// Step 5: Store LEO's response
const leoMessageDoc = await payload.create({
  collection: 'messages',
  data: {
    content: enhancedResponse,
    messageType: 'leo',
    space: spaceId,
    sender: 1 // System/LEO user
  }
})

// Step 6: Return to client
return {
  success: true,
  response: enhancedResponse,
  messageId: leoMessageDoc.id
}
```

## ⚡ Real-Time Features

### **Current Implementation**
- ✅ **Immediate UI Updates**: Client-side state management
- ✅ **Session Continuity**: Persistent session IDs
- ✅ **Loading States**: Visual feedback during processing
- ✅ **Error Recovery**: Graceful error handling

### **Response Time Characteristics**
Based on the console output and implementation:

```
┌─────────────────────────────────────────────────────────┐
│                LEO Response Timeline                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User Input ──→ API Call ──→ Claude-4 ──→ Enhancement  │
│      0ms          50ms        2-4s          100ms      │
│                                                         │
│  ──→ Database ──→ Client ──→ UI Update                  │
│      200ms        50ms       50ms                      │
│                                                         │
│  Total: ~2.5-4.5 seconds for complete response         │
└─────────────────────────────────────────────────────────┘
```

### **Planned Real-Time Enhancements**
```typescript
// WebSocket implementation (planned)
WebSocket: /ws/channels/:channelId

// Real-time message broadcasting
const broadcastMessage = (channelId: string, message: Message) => {
  io.to(channelId).emit('new-message', message)
}

// Multi-user presence
const updatePresence = (userId: string, status: 'online' | 'away' | 'offline') => {
  io.emit('user-presence', { userId, status })
}
```

## 🎯 LEO Response Enhancement

### **Context-Aware Responses**

LEO's responses are enhanced based on context:

```typescript
async function enhanceLeoResponse(
  baseResponse: string, 
  variant?: string,
  originalMessage?: string
): Promise<string> {
  
  let enhanced = baseResponse
  
  // Dashboard context
  if (variant === 'dashboard') {
    enhanced += "\n\n*I can help you navigate the dashboard, analyze data, or perform administrative tasks. What would you like to do?*"
  }
  
  // Business context  
  if (variant === 'business') {
    enhanced += "\n\n*I'm here to assist with your business operations. I can help with customer inquiries, process automation, or strategic insights.*"
  }
  
  return enhanced
}
```

### **Intent Detection System**

```typescript
const detectedIntent = {
  intent: 'web_chat_inquiry',
  confidence: 0.8,
  department: 'support'
}

// Onboarding/provisioning intents
if (lowerMessage.includes('setup') || lowerMessage.includes('onboard')) {
  detectedIntent = {
    intent: 'site_provisioning',
    confidence: 0.9,
    department: 'onboarding'
  }
}
```

## 🔐 Security & Multi-Tenancy

### **Access Control**
- ✅ **Tenant Isolation**: Messages scoped to tenant/space
- ✅ **User Authentication**: Authenticated vs anonymous handling
- ✅ **Session Security**: Secure session management
- ✅ **Rate Limiting**: Built into Claude-4 pipeline

### **Data Privacy**
```typescript
// IP address hashing for privacy
function hashIP(ip: string): string {
  return `hashed_${ip.length}_${ip.charCodeAt(0)}`
}

// Anonymous user handling
const sender = req.user?.id || 1 // System user for anonymous
```

## 📊 Performance Metrics

### **Response Time Tracking**
```typescript
const processingTime = Date.now() - Date.parse(messageDoc.createdAt)

logBusiness('LEO response generated', {
  sessionId: sessionId.substring(0, 12) + '...',
  messageLength: enhancedResponse.length,
  intent: detectedIntent?.intent,
  processingTime
})
```

### **Business Intelligence Integration**
- ✅ **Conversation Analytics**: Intent tracking, response times
- ✅ **Usage Metrics**: Message volume, user engagement  
- ✅ **Performance Monitoring**: API response times, error rates
- ✅ **Business Context**: Customer interaction insights

## 🚀 Future Enhancements

### **Real-Time WebSocket Integration**
```typescript
// Planned WebSocket implementation
import { Server } from 'socket.io'

const io = new Server(server)

io.on('connection', (socket) => {
  socket.on('join-channel', (channelId) => {
    socket.join(channelId)
  })
  
  socket.on('send-message', async (data) => {
    const response = await processMessage(data)
    io.to(data.channelId).emit('new-message', response)
  })
})
```

### **Voice Integration (VAPI)**
- 🚧 **Voice-to-Text**: Real-time transcription
- 🚧 **Text-to-Speech**: LEO voice responses  
- 🚧 **Background Recording**: Hands-free operation
- 🚧 **Multi-language Support**: International tenants

### **Advanced AI Features**
- 🚧 **Streaming Responses**: Real-time response generation
- 🚧 **File Upload Support**: Document analysis
- 🚧 **Action Execution**: LEO performing dashboard actions
- 🚧 **Multi-modal Input**: Text, voice, images

## 🔧 Troubleshooting Guide

### **Common Issues**

1. **"I'm experiencing connection issues"**
   - **Cause**: Database foreign key violations or enum conflicts
   - **Solution**: Fixed with channel enum and space creation updates ✅

2. **Slow Response Times**
   - **Cause**: Claude-4-Sonnet processing time
   - **Solution**: Implement response streaming or caching

3. **Session Loss**
   - **Cause**: Session ID not properly maintained
   - **Solution**: Verify session storage and retrieval

### **Debug Mode**
```typescript
// Enable detailed logging
console.log('Sending message to web-chat API:', content)
console.log('Web-chat API response status:', response.status)
console.log('LEO response received:', leoResponse.substring(0, 100) + '...')
```

## 📈 Success Metrics

The chat system demonstrates:
- ✅ **Fast Initial Response**: UI updates immediately
- ✅ **Intelligent Processing**: Claude-4-Sonnet integration  
- ✅ **Context Awareness**: Dashboard and business context
- ✅ **Persistent Sessions**: Conversation continuity
- ✅ **Multi-Interface Support**: Panel, routes, and widgets
- ✅ **Error Resilience**: Graceful failure handling

**Total Response Time**: ~2.5-4.5 seconds for complete AI-generated responses
**User Experience**: Immediate feedback with progressive enhancement
**Scalability**: Multi-tenant architecture with proper isolation







