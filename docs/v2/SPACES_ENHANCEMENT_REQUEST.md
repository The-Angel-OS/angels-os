# Spaces Enhancement Request - Multi-Functional Collaboration Platform

## 🎯 **Overview**
Transform the current `/dashboard/spaces` interface into a comprehensive Spaces collaboration platform with Discord-like functionality for project collaboration and external user invitations.

**Important:** When we refer to "Spaces" or "Angel sites," we're talking about individual **tenants** in the multi-tenant system. Each Space is a dedicated tenant with its own domain, AI assistant, and collaborative workspace.

## 📸 **Current State**
- ✅ Enhanced Spaces interface at `/dashboard/spaces` 
- ✅ Full CRUD operations for channels with permissions
- ✅ Virtual channel system with lazy loading
- ✅ User invitation system with tenant creation
- ✅ Onboarding flow for creating business tenants

## 🚀 **Enhancement Goals**

### **1. Spaces Sidebar - Multi-Functional Navigation Control**

#### **A. Spaces Chooser (Top Section)**
- **Functionality**: Like existing `TenantChooser` but for Spaces
- **UI Component**: ShadCN searchable combo box
- **Features**:
  - ✅ Dropdown with searchable spaces list
  - 🔧 **FIX NEEDED**: Background transparency makes text unreadable
  - ➕ "Add New Space" option using `UniversalModal`
  - 🖼️ **NEW**: Space image upload capability (Discord-style)
  - 🎨 **NEW**: Display space images in chooser when present

#### **B. Channel Chooser (Middle Section)**
- **Channel Management Icons**:
  - ➕ Add new channel
  - ✏️ Edit channel (if not system/general/PM)
  - 🗑️ Delete channel (if not protected)
- **Channel Types**:
  - **Actual Channels**: Created channels with full properties
  - **Virtual Channels**: Auto-created on first access
  - **PM Channels**: Direct message channels with user status
  - **System Channels**: Protected (general, system)

#### **C. Channel Organization**
```
📋 Channel List Priority:
1. System channels (general, announcements)
2. Project channels 
3. Topic channels
4. PM/DM channels (with user status indicators)
5. Virtual channels (created on-demand)
```

### **2. Virtual Channel System**

#### **Dynamic Channel Creation**
- **Virtual Channels**: Don't exist in DB until accessed
- **On-Access Creation**: 
  - User clicks virtual channel → Creates in DB → Navigates to channel
  - Channel properties become configurable after creation
- **Channel Types**: Any type based on added tabs/functionality

#### **Tabbed Interface Enhancement**
- **Current State**: Perfect tabbed implementation ✅
- **Enhancement**: Dynamic tab system based on channel content
- **Tab Types**:
  - 💬 **Chat Tab** (always present)
  - 📋 **Project Tab** (for project channels)
  - ✅ **Tasks Tab** (filtered to channel)
  - 👥 **Contacts Tab** (channel members)
  - 📁 **Files Tab** (channel file sharing)
  - 📊 **Analytics Tab** (channel insights)
  - ⚙️ **Settings Tab** (channel configuration)

### **3. External Collaboration Features**

#### **Space Invitations**
- **Target Users**: Non-system users (external collaborators)
- **Invitation Flow**:
  1. Send invite link to external user
  2. User creates limited account (space-scoped)
  3. Access to specific Space dashboard
  4. Collaboration within invited space only

#### **Spaces Dashboard for External Users**
- **Scoped Access**: Only see invited space content
- **Dashboard Features**: 
  - Space overview
  - Assigned tasks
  - Shared files
  - Project updates
  - Communication channels
- **UI**: Existing ShadCN dashboard structure (reuse current components)

### **4. Technical Implementation Plan**

#### **Phase 1: Spaces Sidebar Enhancement**
```typescript
// Components to Create/Enhance:
- SpacesChooser (based on TenantChooser)
- ChannelManager (with CRUD operations)  
- VirtualChannelProvider (lazy loading)
- SpaceImageUpload (using UniversalModal)
```

#### **Phase 2: Virtual Channel System**
```typescript
// Database Changes:
- channels.virtual (boolean flag)
- channels.created_on_access (timestamp)
- channels.tabs (JSON array of enabled tabs)

// API Endpoints:
- POST /api/channels/virtual/{channelId}/activate
- GET /api/channels/{channelId}/tabs
- PUT /api/channels/{channelId}/tabs
```

#### **Phase 3: External User System**
```typescript
// New Collections:
- SpaceInvitations
- ExternalUsers (space-scoped accounts)
- SpaceMemberships (with role-based permissions)

// Features:
- Invitation email system
- Limited user registration
- Space-scoped authentication
```

#### **Phase 4: Dynamic Tabs System**
```typescript
// Tab Registry:
interface ChannelTab {
  id: string
  label: string
  component: React.ComponentType
  permissions: string[]
  filter?: (channelId: string) => any
}

// Dynamic Tab Loading:
- TasksTab (filtered by channel)
- ProjectTab (channel-specific projects)
- ContactsTab (channel members)
- FilesTab (channel file sharing)
```

## 🎨 **UI/UX Specifications**

### **Spaces Chooser Design**
- **Style**: Discord-inspired space selector
- **Image Support**: 40x40px space avatars
- **Fallback**: Space initials with gradient background
- **Search**: Real-time filtering of available spaces
- **Add Button**: Prominent "+" for creating new spaces

### **Channel List Design**
```
🏠 # general                    [👥 12]
📋 # project-alpha             [👥 5] [✏️] [🗑️]
💬 # random                    [👥 8] [✏️] [🗑️]
👤 Kenneth Courtney           [🟢] [💬]
👤 John Doe                   [🟡] [💬]
➕ Add Channel...
```

### **Tab Interface**
- **Current Implementation**: Perfect ✅
- **Enhancement**: Dynamic tab loading based on channel configuration
- **Visual**: Consistent with existing chat tabs

## 🔧 **Immediate Fixes Needed**

1. **Dropdown Transparency**: Fix ShadCN combo box background readability
2. **Spaces Route**: Revive dead `/spaces` route 
3. **Channel CRUD**: Add channel management operations
4. **Image Upload**: Implement space avatar upload system

## 📋 **Success Criteria**

- ✅ External users can be invited to specific spaces
- ✅ Virtual channels create seamlessly on first access  
- ✅ Dynamic tabs load based on channel configuration
- ✅ Space images display properly in chooser
- ✅ Channel management (add/edit/delete) works intuitively
- ✅ External users see scoped dashboard for their space
- ✅ All existing chat functionality remains intact

## 🎯 **Business Value**

- **Client Collaboration**: Invite clients to project spaces
- **Team Management**: Organize projects with dedicated spaces
- **External Partnerships**: Collaborate with vendors/contractors
- **Scalable Architecture**: Foundation for advanced collaboration features
- **Revenue Opportunity**: Premium spaces features for higher tiers

---

**Status**: Pre-Production Enhancement Request  
**Priority**: High (Core collaboration feature)  
**Estimated Effort**: 3-4 development cycles  
**Dependencies**: Current chat system, UniversalModal, ShadCN components
