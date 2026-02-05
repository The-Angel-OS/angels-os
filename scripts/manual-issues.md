# Angel OS MVP Issues - Manual Creation Guide

Copy-paste these directly into GitHub Issues at: https://github.com/The-Angel-OS/angels-os/issues/new

---

## Issue 1/21

**Title:** Implement Platform Tenant and Archangel LEO

**Labels:** epic: infrastructure, priority: critical, type: feature

**Body:**
```
Create the foundational two-tier angel system with Platform Tenant and Archangel LEO.

## Requirements

1. **Platform Tenant Collection Enhancement**
   - Add `type` field to Tenants: `'platform' | 'tenant'`
   - Create special platform tenant (ID: `'platform'`)
   - Platform tenant is singleton (only one can exist)

2. **Archangel Role**
   - Add `'archangel'` role to Users collection
   - Archangels have access to all tenants
   - Archangels can provision new tenants

3. **Seed Script**
   - Create platform tenant on first seed
   - Create Archangel LEO user
   - Set up Guardian Council Space (platform-level)

## Acceptance Criteria

- [ ] Platform tenant exists with type `'platform'`
- [ ] Archangel LEO user created with `isSystemUser: true`
- [ ] Archangels can access all tenant data
- [ ] Regular Angels can only access their own tenant
- [ ] Seed script creates platform tenant automatically

## Technical Notes

```typescript
// src/collections/Tenants.ts
{
  name: 'type',
  type: 'select',
  options: ['platform', 'tenant'],
  defaultValue: 'tenant',
  required: true
}

// src/endpoints/seed/seed-helpers.ts
export async function seedPlatformTenant() {
  const platformTenant = await payload.create({
    collection: 'tenants',
    data: {
      id: 'platform',
      name: 'Angel OS Platform',
      type: 'platform'
    }
  })
  
  const archangelLeo = await payload.create({
    collection: 'users',
    data: {
      email: 'archangel@angel-os.org',
      name: 'Archangel LEO',
      tenant: 'platform',
      roles: ['archangel'],
      isSystemUser: true
    }
  })
  
  return { platformTenant, archangelLeo }
}
```

**Epic:** Core Infrastructure & Two-Tier Angel System
**Priority:** Critical
```

---

## Issue 2/21

**Title:** Implement Angel Configuration and Custom Naming

**Labels:** epic: infrastructure, priority: high, type: feature

**Body:**
```
Allow each tenant's Angel to be named and configured with personality/capabilities.

## Requirements

1. **Angel Config Field**
   - Add `angelConfig` to Users collection
   - Fields: `angelName`, `personality`, `capabilities`, `appearance`

2. **Angel Customization UI**
   - Admin panel for tenant admins to customize their Angel
   - Name, personality tone, avatar, color

3. **Angel Initialization**
   - When tenant is provisioned, create Angel user
   - Angel gets default name (customizable)
   - Angel is marked as `isSystemUser: true`

## Acceptance Criteria

- [ ] Users collection has `angelConfig` field
- [ ] Tenant admins can customize Angel name
- [ ] Angel personality affects response tone
- [ ] Angel avatar/color displayed in UI
- [ ] Each tenant has exactly one Angel user

## Technical Notes

```typescript
// src/collections/Users.ts
{
  name: 'angelConfig',
  type: 'group',
  admin: {
    condition: (data) => data.isSystemUser === true
  },
  fields: [
    { name: 'angelName', type: 'text', required: true },
    { name: 'personality', type: 'textarea' },
    { name: 'capabilities', type: 'array', fields: [
      { name: 'capability', type: 'text' }
    ]},
    { name: 'appearance', type: 'group', fields: [
      { name: 'avatar', type: 'upload', relationTo: 'media' },
      { name: 'color', type: 'text' }
    ]}
  ]
}
```

**Epic:** Core Infrastructure & Two-Tier Angel System
**Priority:** High
```

---

## Issue 3/21

**Title:** Create Channel Widgets System

**Labels:** epic: widgets, priority: high, type: feature

**Body:**
```
Implement widget-based channel architecture where channels have tabs (chat, LiveKit, Notion, Trello, etc.) instead of channel types.

## Requirements

1. **ChannelWidgets Collection**
   - Define available widgets (Chat, LiveKit, Notion Notes, Trello Board, etc.)
   - Widget metadata: name, slug, component path, capabilities

2. **InstalledWidgets Collection**
   - Track which widgets are installed in which Spaces/Channels
   - Widget-specific configuration
   - Tab order

3. **Widget Component Interface**
   - Standard props for all widgets
   - Access to channel context
   - Access to Angel

## Acceptance Criteria

- [ ] ChannelWidgets collection created
- [ ] InstalledWidgets collection created
- [ ] At least 3 widgets defined (Chat, LiveKit, Notion Notes)
- [ ] Widgets can be installed at Space level
- [ ] Widgets populate on channels as tabs

## Technical Notes

```typescript
// src/collections/ChannelWidgets.ts
export const ChannelWidgets: CollectionConfig = {
  slug: 'channel-widgets',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'description', type: 'textarea' },
    { name: 'icon', type: 'text' },
    { name: 'component', type: 'text', required: true },
    { name: 'capabilities', type: 'array', fields: [
      { name: 'capability', type: 'text' }
    ]},
    { name: 'installableAt', type: 'select', options: ['space', 'channel', 'both'] },
    { name: 'settings', type: 'json' }
  ]
}
```

**Epic:** Channel Widget Architecture
**Priority:** High
```

---

🚀 **SPEED TIP**: Create the first 3 critical issues now, then use the automated script for the remaining 18:

1. **Create Issues 1-3 manually** (copy-paste above)
2. **Run the automated script** for Issues 4-21:
```bash
gh auth login
cd C:\Dev\angels-os
node scripts/create-github-issues.mjs
```

This hybrid approach gets the most important issues up quickly while handling bulk creation efficiently.

**Want me to continue with manual templates for all 21 issues, or shall we try the GitHub CLI automation?**