# AT Protocol + Collections Architecture

## Philosophy: Everything is a Message

In Angel OS, we follow the AT Protocol philosophy where **everything is fundamentally a message**, but we use a **dual-layer architecture** for practical business needs.

## Dual-Layer Architecture

### Layer 1: Structured Collections (Business Logic)
**Purpose**: Handle complex business operations, relationships, and validation
**Examples**: 
- `Appointments` - Complex scheduling with bay management, payments, recurrence
- `Products` - E-commerce with inventory, pricing, variants
- `Users` - Authentication, roles, permissions
- `Spaces` - Multi-tenant workspace management

### Layer 2: AT Protocol Messages (Federation & History)
**Purpose**: Create federated, searchable message stream for all activities
**Examples**:
- Appointment created → System message with appointment details
- File uploaded → System message with media reference
- User joined → System message with user activity
- Task completed → System message with task data

## How They Work Together

### 1. Appointments Example

```typescript
// User creates appointment via UI
const appointment = await payload.create({
  collection: 'appointments',
  data: {
    title: "Client Consultation",
    startTime: "2025-08-20T14:00:00Z",
    appointmentType: "consultation",
    organizer: userId,
    tenant: tenantId
  }
})

// Automatically creates AT Protocol message
const message = await payload.create({
  collection: 'messages',
  data: {
    content: {
      type: 'system',
      systemData: {
        eventType: 'task_assigned',
        details: { appointmentId: appointment.id, ...appointmentData }
      }
    },
    messageType: 'system',
    atProtocol: {
      did: `did:plc:${tenantId}`,
      type: 'co.kendev.spaces.appointment',
      uri: `at://did:plc:${tenantId}/co.kendev.spaces.appointment/${appointment.id}`
    }
  }
})
```

### 2. File Management Example

```typescript
// User uploads file
const mediaFile = await payload.create({
  collection: 'media',
  data: { /* file data */ }
})

// Creates message with file reference
const message = await payload.create({
  collection: 'messages',
  data: {
    content: {
      type: 'system',
      systemData: {
        eventType: 'file_uploaded',
        details: { mediaId: mediaFile.id, filename: mediaFile.filename }
      }
    },
    attachments: [mediaFile.id],
    atProtocol: {
      type: 'co.kendev.spaces.media'
    }
  }
})
```

## Benefits of This Architecture

### 1. **Business Logic Integrity**
- Complex validations in collections (appointment time conflicts, payment processing)
- Proper relationships and constraints
- Business-specific hooks and workflows

### 2. **Federation & Searchability**  
- All activities become searchable messages
- Cross-tenant federation via AT Protocol
- Universal activity stream
- BlueSky integration for public activities

### 3. **Audit Trail**
- Every business action creates a message
- Complete history of all system activities
- Federated backup of critical business data

### 4. **AI Integration**
- LEO can understand all business activities via message stream
- Business intelligence from unified message data
- Cross-collection insights and recommendations

## Implementation Pattern

### Collection Hook Pattern
```typescript
// In collection definition
hooks: {
  afterChange: [
    async ({ doc, operation }) => {
      // Create corresponding AT Protocol message
      await createSystemMessage({
        type: 'system',
        systemData: {
          eventType: 'appointment_updated',
          details: doc
        },
        atProtocol: {
          type: 'co.kendev.spaces.appointment',
          uri: `at://did:plc:${doc.tenant}/co.kendev.spaces.appointment/${doc.id}`
        }
      })
    }
  ]
}
```

### Service Layer Pattern
```typescript
class AppointmentService {
  async createAppointment(data) {
    // 1. Create in structured collection
    const appointment = await payload.create({
      collection: 'appointments',
      data
    })
    
    // 2. Create AT Protocol message
    const message = await this.createMessage(appointment)
    
    // 3. Return both references
    return { appointment, message }
  }
}
```

## Calendar Implementation

The calendar now:
1. **Displays appointments** from the Appointments collection
2. **Creates proper appointments** with full business logic
3. **Generates AT Protocol messages** for federation
4. **Maintains message history** for LEO AI integration

## File Manager Implementation

The file manager:
1. **Manages media** via the Media collection  
2. **Tracks file usage** via message attachments
3. **Handles deletion** with remote storage cleanup
4. **Creates activity messages** for all file operations

This gives us the best of both worlds: robust business logic AND federated message streams!


