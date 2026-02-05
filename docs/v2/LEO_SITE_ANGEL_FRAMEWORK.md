# LEO/Site Angel AI Framework
## Conversational Multi-Tenant Management System

### **Architecture Overview**

The LEO/Site Angel framework provides a hierarchical AI system for Angel OS:

- **LEO (Global)**: Platform-wide AI accessible to super admins and cross-tenant operations
- **Site Angels**: Tenant-scoped AI personalities for local business operations

### **Hierarchy & Permissions**

```
LEO (Global AI)
├── Tenant Provisioning & Management
├── Cross-tenant Analytics
├── Platform Administration
└── Site Angel Orchestration

Site Angel (Per Tenant)
├── User Onboarding & Support
├── Business Intelligence
├── Workflow Automation
├── Customer Service
└── Local Content Management
```

### **Core Capabilities**

#### **LEO (Platform Level)**
- **Tenant Provisioning**: "Create a new tenant for Dave's Cactus Farm"
- **Tenant Packaging**: Export tenant configurations as portable DNN-style modules
- **Cross-tenant Analytics**: Platform-wide insights and optimization
- **System Administration**: Database management, migrations, updates

#### **Site Angels (Tenant Level)**
- **Conversational UX**: Natural language interaction for all business functions
- **Context Awareness**: Understanding current page, user role, and business state
- **Workflow Execution**: Trigger n8n workflows, VAPI calls, business processes
- **Customer Support**: Handle inquiries, bookings, order management
- **Business Intelligence**: Generate reports, insights, recommendations

### **Implementation Strategy**

#### **Phase 1: Foundation (Current)**
- ✅ Site Angel collection schema
- ✅ Basic LEO integration in chat bubble
- ✅ Tenant-scoped AI personalities
- 🔄 Conversational command processing

#### **Phase 2: Enhanced Capabilities**
- Voice integration (VAPI) for hands-free operation
- Advanced context awareness (page, user, business state)
- Workflow automation triggers
- Business intelligence generation

#### **Phase 3: Advanced Features**
- Multi-being interactions (Leo + Andrew Martin + Site Angels)
- AT Protocol federation for cross-platform AI communication
- Advanced tenant packaging and portability
- Self-improving AI through usage analytics

### **Conversational Interface Design**

#### **LEO Commands (Global)**
```
"LEO, provision a new tenant for Dave's Cactus Farm"
"LEO, show me platform analytics for this month"
"LEO, package the KenDev.Co tenant for export"
"LEO, migrate all tenants to the latest schema"
```

#### **Site Angel Commands (Tenant-scoped)**
```
"Create a new product listing for our cactus collection"
"Schedule a consultation call for next Tuesday"
"Show me this month's sales analytics"
"Send a follow-up email to recent customers"
"Update the homepage hero section"
```

### **Technical Architecture**

#### **Chat Context Provider**
```typescript
interface ChatContext {
  user: User
  tenant: Tenant
  currentPage: string
  userRole: string
  businessState: {
    activeOrders: number
    pendingAppointments: number
    recentActivity: Activity[]
  }
}
```

#### **AI Agent Configuration**
```typescript
interface AIAgent {
  name: string
  role: 'leo' | 'site-angel'
  tenant?: string
  capabilities: string[]
  permissions: {
    canProvisionTenants: boolean
    canManageUsers: boolean
    canExecuteWorkflows: boolean
    canAccessAnalytics: boolean
  }
}
```

### **Integration Points**

#### **Dashboard Integration**
- Universal chat bubble on all pages
- Context-aware suggestions based on current view
- Quick actions and shortcuts
- Real-time notifications and alerts

#### **Business Process Integration**
- n8n workflow triggers
- VAPI voice automation
- Stripe payment processing
- Calendar and booking systems
- Email and SMS notifications

#### **Data & Analytics Integration**
- Real-time business metrics
- Customer behavior analytics
- Performance optimization insights
- Predictive business intelligence

### **Security & Privacy**

#### **Tenant Isolation**
- Site Angels are strictly scoped to their tenant
- No cross-tenant data access
- Encrypted communication channels
- Audit logging for all AI actions

#### **Permission Management**
- Role-based AI capabilities
- Granular permission controls
- Admin override capabilities
- Compliance with business rules

### **Future Vision**

#### **Distributed AI Network**
- Site Angels can communicate with each other (with permission)
- Cross-tenant learning and optimization
- AT Protocol federation for external AI communication
- Decentralized AI decision making

#### **Business Ecosystem**
- AI-powered business recommendations
- Automated vendor management
- Supply chain optimization
- Market trend analysis and adaptation

### **Development Roadmap**

#### **Immediate (Next Sprint)**
1. Enhanced chat context awareness
2. Basic workflow automation triggers
3. Business intelligence queries
4. Voice input/output integration

#### **Short Term (1-2 Months)**
1. Advanced tenant provisioning via conversation
2. Cross-platform AI communication
3. Automated business process optimization
4. Predictive analytics and recommendations

#### **Long Term (3-6 Months)**
1. Full AT Protocol federation
2. Self-improving AI through usage analytics
3. Advanced multi-being interactions
4. Autonomous business optimization

---

**"Every tenant gets their own Guardian Angel, while LEO watches over the entire ecosystem."**

*This framework transforms Angel OS from a platform into a living, breathing business ecosystem where AI and humans collaborate seamlessly.*
