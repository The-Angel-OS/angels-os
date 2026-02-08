// Tenant Import/Export Service - DNN Module Style packaging

export interface TenantPackage {
  metadata: {
    name: string
    version: string
    exportedAt: string
    exportedBy: string
    angelOSVersion: string
  }
  tenant: {
    name: string
    slug: string
    businessType: string
    configuration: any
    features: any
    limits: any
  }
  users: any[]
  spaces: any[]
  channels: any[]
  messages: any[]
  posts: any[]
  products: any[]
  media: any[]
  appointments: any[]
  customData?: Record<string, any[]>
}

export class TenantImportExportService {
  /**
   * Export complete tenant data package
   */
  static async exportTenant(tenantId: string): Promise<TenantPackage> {
    console.log(`📦 Exporting tenant ${tenantId}...`)
    
    // Get tenant data
    const tenant = await this.fetchData('tenants', tenantId)
    
    // Get all related data
    const [
      users,
      spaces,
      channels,
      messages,
      posts,
      products,
      media,
      appointments
    ] = await Promise.all([
      this.fetchTenantData('users', tenantId),
      this.fetchTenantData('spaces', tenantId),
      this.fetchTenantData('channels', tenantId),
      this.fetchTenantData('messages', tenantId),
      this.fetchTenantData('posts', tenantId),
      this.fetchTenantData('products', tenantId),
      this.fetchTenantData('media', tenantId),
      this.fetchTenantData('appointments', tenantId)
    ])

    const tenantPackage: TenantPackage = {
      metadata: {
        name: `${tenant.name} Export`,
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedBy: 'Angel OS Export System',
        angelOSVersion: '1.0.0'
      },
      tenant,
      users,
      spaces,
      channels,
      messages,
      posts,
      products,
      media,
      appointments
    }

    console.log(`✅ Exported tenant package: ${Object.keys(tenantPackage).length} sections`)
    return tenantPackage
  }

  /**
   * Import tenant package
   */
  static async importTenant(packageData: TenantPackage): Promise<string> {
    console.log(`📥 Importing tenant package: ${packageData.metadata.name}...`)
    
    try {
      // 1. Create/update tenant
      const tenant = await this.importTenantData('tenants', packageData.tenant)
      const newTenantId = tenant.id

      // 2. Import users and create memberships
      for (const user of packageData.users) {
        const importedUser = await this.importTenantData('users', {
          ...user,
          tenant: newTenantId
        })
        
        // Create tenant membership
        await this.createTenantMembership(importedUser.id, newTenantId, user.role || 'member')
      }

      // 3. Import spaces
      for (const space of packageData.spaces) {
        await this.importTenantData('spaces', {
          ...space,
          tenant: newTenantId
        })
      }

      // 4. Import other collections
      const collections = ['channels', 'messages', 'posts', 'products', 'appointments']
      for (const collection of collections) {
        const data = packageData[collection as keyof TenantPackage] as any[]
        if (Array.isArray(data)) {
          for (const item of data) {
            await this.importTenantData(collection, {
              ...item,
              tenant: newTenantId
            })
          }
        }
      }

      // 5. Import media files
      for (const mediaItem of packageData.media) {
        await this.importMediaFile(mediaItem, newTenantId)
      }

      console.log(`✅ Successfully imported tenant: ${packageData.tenant.name}`)
      return newTenantId
    } catch (error) {
      console.error('❌ Failed to import tenant package:', error)
      throw error
    }
  }

  /**
   * Fetch tenant-specific data
   */
  private static async fetchTenantData(collection: string, tenantId: string): Promise<any[]> {
    try {
      const response = await fetch(`/api/${collection}?tenant=${tenantId}&limit=1000`)
      if (response.ok) {
        const data = await response.json()
        return data.docs || []
      }
    } catch (error) {
      console.error(`Failed to fetch ${collection} for tenant ${tenantId}:`, error)
    }
    return []
  }

  /**
   * Fetch single item by ID
   */
  private static async fetchData(collection: string, id: string): Promise<any> {
    const response = await fetch(`/api/${collection}/${id}`)
    if (response.ok) {
      return await response.json()
    }
    throw new Error(`Failed to fetch ${collection} ${id}`)
  }

  /**
   * Import data into collection
   */
  private static async importTenantData(collection: string, data: any): Promise<any> {
    const response = await fetch(`/api/${collection}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    
    if (response.ok) {
      return await response.json()
    }
    
    throw new Error(`Failed to import ${collection} data`)
  }

  /**
   * Create tenant membership
   */
  private static async createTenantMembership(userId: string, tenantId: string, role: string): Promise<void> {
    try {
      await fetch('/api/tenant-memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: userId,
          tenant: tenantId,
          role,
          status: 'active',
          joinedAt: new Date().toISOString()
        })
      })
    } catch (error) {
      console.log('Could not create tenant membership, collection may not exist')
    }
  }

  /**
   * Import media file with download
   */
  private static async importMediaFile(mediaItem: any, tenantId: string): Promise<any> {
    try {
      // Download the file first
      const fileResponse = await fetch(mediaItem.url)
      if (!fileResponse.ok) {
        throw new Error(`Failed to download media: ${mediaItem.url}`)
      }

      const blob = await fileResponse.blob()
      const formData = new FormData()
      formData.append('file', blob, mediaItem.filename)
      formData.append('alt', mediaItem.alt || '')
      formData.append('tenant', tenantId)

      // Upload to media collection
      const uploadResponse = await fetch('/api/media', {
        method: 'POST',
        body: formData
      })

      if (uploadResponse.ok) {
        return await uploadResponse.json()
      }
      
      throw new Error('Failed to upload media file')
    } catch (error) {
      console.error(`Failed to import media file ${mediaItem.filename}:`, error)
      return null
    }
  }

  /**
   * Generate download for tenant package
   */
  static async downloadTenantPackage(tenantId: string): Promise<void> {
    const packageData = await this.exportTenant(tenantId)
    
    const blob = new Blob([JSON.stringify(packageData, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${packageData.tenant.slug}-export-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    console.log(`💾 Downloaded tenant package: ${a.download}`)
  }

  /**
   * Upload and import tenant package
   */
  static async uploadTenantPackage(file: File): Promise<string> {
    try {
      const text = await file.text()
      const packageData: TenantPackage = JSON.parse(text)
      
      // Validate package format
      if (!packageData.metadata || !packageData.tenant) {
        throw new Error('Invalid tenant package format')
      }
      
      return await this.importTenant(packageData)
    } catch (error) {
      console.error('Failed to upload tenant package:', error)
      throw error
    }
  }
}
