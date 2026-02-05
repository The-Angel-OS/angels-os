# Dashboard Functionality Inventory & Implementation Plan

## Current Status Overview

### ✅ **Implemented & Working**

#### **Chat Systems**
- **Leo AI Panel** - Admin dashboard floating chat bubble (`src/components/AdminDashboard/LeoAIPanel.tsx`)
  - Floating chat button (bottom-right)
  - Slide-out panel from right side
  - Admin-aware responses
  - User context integration
  - Minimizable/closeable

- **Spaces Chat Components** - Multiple chat implementations for spaces
  - `LeoAIDrawer` - Drawer-style chat for spaces layout
  - `ChatControl` - Reusable chat component for channels
  - `SpacesChatArea` - Main chat area for spaces
  - `ShadcnChannelContent` - Channel-specific chat content
  - `CustomerContainer` - Customer service chat interface

#### **Dashboard Pages (v0.dev Implementation)**
- **Overview Dashboard** (`/dashboard`) - Main dashboard with metrics, charts
- **Settings Page** (`/dashboard/settings`) - Basic profile settings
- **Calendar** (`/dashboard/calendar`) - Calendar interface
- **E-commerce** (`/dashboard/ecommerce`) - Commerce dashboard
- **Orders** (`/dashboard/orders`) - Order management
- **Products** (`/dashboard/products`) - Product management
- **CRM** (`/dashboard/crm`) - Customer relationship management
- **File Manager** (`/dashboard/file-manager`) - File management interface
- **Website Analytics** (`/dashboard/website-analytics`) - Analytics dashboard
- **Spaces** (`/dashboard/spaces`) - Spaces management

#### **Integration Hub**
- **Integration Hub Component** (`src/components/IntegrationHub/index.tsx`)
  - Google Calendar integration
  - Gmail integration  
  - Google Photos integration
  - Google Drive integration
  - Dropbox integration
  - OneDrive integration
  - iCloud Photos integration
  - Facebook integration
  - Instagram integration
  - Twitter/X integration
  - LinkedIn integration
  - Slack integration
  - Discord integration
  - Stripe integration
  - PayPal integration
  - And many more...

#### **Admin Dashboard**
- **AdminDashboard** (`src/components/AdminDashboard/index.tsx`)
  - Role-based access (Super Admin, Platform Admin, Tenant Admin)
  - Collection management cards
  - Development tools (seeding, templates)
  - Leo AI integration
  - Streamlined navigation (only implemented collections)

### ❌ **Missing/Needs Implementation**

#### **Settings Integration**
- **Integrations Tab Missing** - Settings page needs "Integrations" section
- **User-Specific Integration Config** - Personal integration settings per user
- **OAuth Flow Integration** - Connect settings to actual OAuth flows
- **Integration Status Display** - Show connected/disconnected status in settings

#### **Chat Bubble for Public Pages**
- **Traditional Chat Bubble** - Missing for frontend/public pages
- **Universal Leo Access** - Chat should be available on all pages
- **Context-Aware Responses** - Leo should know current page context

#### **Settings Functionality**
- **Integration Management** - Wire integrations hub into settings
- **User Preferences** - Advanced user preference management
- **Notification Settings** - Email/push notification preferences
- **Privacy Controls** - User privacy and data controls
- **API Key Management** - User API key generation/management

#### **Dashboard Wiring**
- **Real Data Integration** - Most dashboard pages show mock data
- **Payload CMS Integration** - Wire dashboard to actual collections
- **User Context** - Dashboard should show user-specific data
- **Tenant Context** - Multi-tenant data filtering

## Implementation Plan

### **Phase 1: Settings Integration (Priority 1)**

#### **1.1 Add Integrations to Settings Navigation**
```typescript
// Update src/app/dashboard/settings/page.tsx
const settingsNavigation = [
  { id: 'profile', label: 'Profile', active: true },
  { id: 'account', label: 'Account' },
  { id: 'integrations', label: 'Integrations' }, // ADD THIS
  { id: 'appearance', label: 'Appearance' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'display', label: 'Display' }
]
```

#### **1.2 Create User Integration Settings Component**
```typescript
// Create src/app/dashboard/settings/components/IntegrationSettings.tsx
interface UserIntegration {
  id: string
  name: string
  isConnected: boolean
  lastSync?: Date
  config: Record<string, any>
}
```

#### **1.3 Integration Management Features**
- **Connect/Disconnect** - OAuth flow integration
- **Configuration** - Service-specific settings (Google Photos album selection)
- **Status Display** - Connection health, last sync, errors
- **Permissions** - Granular permission management
- **Auto-Sync Settings** - Configure automatic data ingestion

### **Phase 2: Universal Chat Implementation (Priority 2)**

#### **2.1 Create Universal Chat Provider**
```typescript
// Create src/providers/ChatProvider.tsx
export const ChatProvider = ({ children }) => {
  // Manage chat state globally
  // Provide chat context to all pages
}
```

#### **2.2 Frontend Chat Bubble Component**
```typescript
// Create src/components/chat/UniversalChatBubble.tsx
interface UniversalChatBubbleProps {
  variant: 'admin' | 'frontend' | 'spaces'
  pageContext?: string
  userContext?: User
}
```

#### **2.3 Chat Context Integration**
- **Page Awareness** - Leo knows current page/collection
- **User Context** - Personalized responses based on user role
- **Action Suggestions** - Leo can suggest relevant actions
- **Navigation Assistance** - Help users find what they need

### **Phase 3: Dashboard Data Wiring (Priority 3)**

#### **3.1 Real Data Hooks**
```typescript
// Update src/app/dashboard/_hooks/usePayloadData.ts
export function useDashboardMetrics(tenantId?: string) {
  // Real metrics from Payload collections
}

export function useUserIntegrations(userId: string) {
  // User-specific integration status
}
```

#### **3.2 Collection Integration**
- **Products Dashboard** - Wire to Products collection
- **Orders Dashboard** - Wire to Orders collection  
- **CRM Dashboard** - Wire to Contacts collection
- **Analytics** - Real analytics from collections

#### **3.3 Multi-Tenant Support**
- **Tenant Filtering** - All data filtered by user's tenant
- **Role-Based Access** - Different data based on user role
- **Permission Checking** - Verify user permissions for each action

### **Phase 4: Advanced Features (Priority 4)**

#### **4.1 Auto-Ingestion System**
- **Google Photos** - Select album for auto-ingestion
- **Google Drive** - Monitor folders for new files
- **Dropbox/OneDrive** - File sync and processing
- **Email Integration** - Process attachments from Gmail

#### **4.2 Social Media Posting System**
- **User Impersonation** - Post on behalf of users (with permission)
- **Content Scheduling** - Schedule posts across platforms
- **Analytics Tracking** - Track engagement and performance
- **Template System** - Reusable post templates

#### **4.3 Advanced Chat Features**
- **Voice Input** - Speech-to-text for chat
- **File Upload** - Share files in chat
- **Screen Sharing** - Visual assistance
- **Chat History** - Persistent conversation history

## File Structure Plan

```
src/
├── app/
│   └── dashboard/
│       └── settings/
│           ├── page.tsx (updated with integrations nav)
│           └── components/
│               ├── IntegrationSettings.tsx (NEW)
│               ├── UserPreferences.tsx (NEW)
│               └── NotificationSettings.tsx (NEW)
├── components/
│   ├── chat/
│   │   ├── UniversalChatBubble.tsx (NEW)
│   │   ├── ChatProvider.tsx (NEW)
│   │   └── ChatContext.tsx (NEW)
│   └── integrations/
│       ├── UserIntegrationCard.tsx (NEW)
│       ├── OAuthConnector.tsx (NEW)
│       └── IntegrationStatus.tsx (NEW)
├── hooks/
│   ├── useUserIntegrations.ts (NEW)
│   ├── useChatContext.ts (NEW)
│   └── useUniversalChat.ts (NEW)
└── providers/
    ├── ChatProvider.tsx (NEW)
    └── IntegrationProvider.tsx (NEW)
```

## API Endpoints Needed

```typescript
// User Integration Management
POST /api/user/integrations/connect
DELETE /api/user/integrations/disconnect
GET /api/user/integrations/status
PUT /api/user/integrations/config

// OAuth Flows
GET /api/oauth/[provider]/auth
GET /api/oauth/[provider]/callback

// Auto-Ingestion
POST /api/ingestion/google-photos/sync
POST /api/ingestion/drive/monitor
POST /api/ingestion/dropbox/webhook

// Chat API
POST /api/chat/leo/message
GET /api/chat/leo/context
POST /api/chat/leo/action
```

## Database Schema Extensions

```sql
-- User Integration Settings
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  integration_type VARCHAR(50) NOT NULL,
  is_connected BOOLEAN DEFAULT FALSE,
  access_token TEXT,
  refresh_token TEXT,
  config JSONB DEFAULT '{}',
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat History
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  context_type VARCHAR(50), -- 'admin', 'frontend', 'spaces'
  context_id VARCHAR(255),
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Auto-Ingestion Jobs
CREATE TABLE ingestion_jobs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  integration_id UUID REFERENCES user_integrations(id),
  job_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  config JSONB DEFAULT '{}',
  result JSONB,
  scheduled_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Testing Strategy

### **Unit Tests**
- Chat component functionality
- Integration connection flows
- OAuth callback handling
- Data hooks and providers

### **Integration Tests**
- End-to-end OAuth flows
- Chat context switching
- Auto-ingestion workflows
- Multi-tenant data filtering

### **User Acceptance Tests**
- Settings page integration management
- Chat bubble on all pages
- Real-time chat responses
- File upload and processing

## Security Considerations

### **OAuth Security**
- Secure token storage
- Token rotation
- Scope limitation
- User consent tracking

### **Chat Security**
- Input sanitization
- Rate limiting
- Context isolation
- Audit logging

### **Data Privacy**
- User data encryption
- Integration data isolation
- GDPR compliance
- Data retention policies

## Performance Considerations

### **Chat Performance**
- Message caching
- Lazy loading of history
- WebSocket connections
- Response optimization

### **Integration Performance**
- Async processing
- Queue management
- Rate limiting
- Batch operations

### **Dashboard Performance**
- Data pagination
- Lazy loading
- Caching strategies
- Real-time updates

---

## Next Steps

1. **Immediate**: Add integrations tab to settings page
2. **Week 1**: Implement user integration management
3. **Week 2**: Create universal chat bubble
4. **Week 3**: Wire dashboard to real data
5. **Week 4**: Implement auto-ingestion system

This inventory provides a comprehensive roadmap for completing the dashboard functionality and integrating all the missing pieces for a production-ready system.


