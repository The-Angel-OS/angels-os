/**
 * Role Display Utilities
 * 
 * Makes existing roles more understandable without changing any permissions
 * or collection structures. Keeps all the hard work on TypeScript fixes intact.
 */

// Simple, clear explanations for existing roles
export const ROLE_EXPLANATIONS = {
  // Global Roles (existing values, friendly explanations)
  'super_admin': {
    display: 'Super Admin',
    description: 'Full platform access - can manage everything',
    level: 'platform'
  },
  'platform_admin': {
    display: 'Platform Admin', 
    description: 'Platform management - can help users and manage tenants',
    level: 'platform'
  },
  'user': {
    display: 'User',
    description: 'Standard user - can participate in assigned spaces',
    level: 'platform'
  },

  // Tenant Roles (existing values, clear explanations)
  'tenant_admin': {
    display: 'Business Admin',
    description: 'Business owner/leader - full control of business settings',
    level: 'business'
  },
  'tenant_manager': {
    display: 'Business Manager',
    description: 'Business manager - can manage team and operations', 
    level: 'business'
  },
  'tenant_member': {
    display: 'Team Member',
    description: 'Business team member - can participate in business activities',
    level: 'business'
  },

  // Space Roles (existing values, friendly explanations)
  'space_admin': {
    display: 'Space Admin',
    description: 'Space leader - can manage space settings and members',
    level: 'space'
  },
  'moderator': {
    display: 'Moderator',
    description: 'Community helper - helps keep discussions friendly',
    level: 'space'
  },
  'member': {
    display: 'Member', 
    description: 'Active participant - can chat and share in this space',
    level: 'space'
  },
  'guest': {
    display: 'Guest',
    description: 'Welcome visitor - can observe and participate',
    level: 'space'
  },

  // Special Roles (existing values, special recognition)
  'guardian_angel': {
    display: 'Guardian Angel',
    description: 'Community helper dedicated to making Angel OS wonderful',
    level: 'special',
    badge: '👼'
  }
} as const

/**
 * Get friendly display name for any role
 */
export function getRoleDisplay(role: string): string {
  return ROLE_EXPLANATIONS[role as keyof typeof ROLE_EXPLANATIONS]?.display || role
}

/**
 * Get clear explanation for any role
 */
export function getRoleDescription(role: string): string {
  return ROLE_EXPLANATIONS[role as keyof typeof ROLE_EXPLANATIONS]?.description || 'Platform participant'
}

/**
 * Get role level (platform, business, space, special)
 */
export function getRoleLevel(role: string): string {
  return ROLE_EXPLANATIONS[role as keyof typeof ROLE_EXPLANATIONS]?.level || 'unknown'
}

/**
 * Get special badge for role (if any)
 */
export function getRoleBadge(role: string): string | undefined {
  // Currently no badges defined in ROLE_EXPLANATIONS
  // This function is reserved for future badge implementation
  return undefined
}

/**
 * Check if role has certain capabilities (without changing permissions)
 */
export function roleCanManageUsers(role: string): boolean {
  return ['super_admin', 'platform_admin', 'tenant_admin', 'space_admin'].includes(role)
}

export function roleCanCreateContent(role: string): boolean {
  return !['guest'].includes(role) // Most roles can create content
}

export function roleCanModerate(role: string): boolean {
  return ['super_admin', 'platform_admin', 'tenant_admin', 'space_admin', 'moderator'].includes(role)
}

/**
 * Get user's primary role for display (highest level role they have)
 */
export function getPrimaryRoleForDisplay(user: any): {
  role: string
  display: string
  description: string
  badge?: string
} {
  // Check for Guardian Angel first (special recognition)
  if (user.roles?.includes('guardian_angel')) {
    return {
      role: 'guardian_angel',
      display: 'Guardian Angel 👼',
      description: 'Community helper dedicated to making Angel OS wonderful',
      badge: '👼'
    }
  }

  // Check global role
  if (user.globalRole) {
    return {
      role: user.globalRole,
      display: getRoleDisplay(user.globalRole),
      description: getRoleDescription(user.globalRole)
    }
  }

  // Fallback
  return {
    role: 'user',
    display: 'Community Member',
    description: 'Welcome to Angel OS!'
  }
}
