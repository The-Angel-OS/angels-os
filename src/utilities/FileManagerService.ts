// File Manager Service
// Manages user media files uploaded via messages

export interface ManagedFile {
  id: string
  filename: string
  originalName: string
  mimeType: string
  filesize: number
  url: string
  alt?: string
  caption?: string
  uploadedAt: string
  uploadedBy: string
  thumbnailUrl?: string
  messageId?: string // Reference to the message that uploaded this file
  spaceId: number
  tenantId?: number
}

export class FileManagerService {
  /**
   * Load all media files for a user/space
   */
  static async loadFiles(spaceId: number = 1, tenantId?: number): Promise<ManagedFile[]> {
    const params = new URLSearchParams({
      limit: '100',
      sort: '-createdAt'
    })

    const response = await fetch(`/api/media?${params}`)
    
    if (!response.ok) {
      console.error('Failed to load media files')
      return []
    }

    const result = await response.json()
    
    return result.docs.map((media: any): ManagedFile => ({
      id: media.id,
      filename: media.filename,
      originalName: media.filename,
      mimeType: media.mimeType,
      filesize: media.filesize,
      url: media.url,
      alt: media.alt,
      caption: media.caption?.root?.children?.[0]?.children?.[0]?.text || '',
      uploadedAt: media.createdAt,
      uploadedBy: media.createdBy || 'Unknown',
      thumbnailUrl: media.sizes?.thumbnail?.url,
      spaceId,
      tenantId
    }))
  }

  /**
   * Delete a media file and remove from storage
   */
  static async deleteFile(fileId: string): Promise<void> {
    const response = await fetch(`/api/media/${fileId}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('Failed to delete media file')
    }
  }

  /**
   * Update media file metadata
   */
  static async updateFile(fileId: string, updates: Partial<ManagedFile>): Promise<void> {
    const response = await fetch(`/api/media/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alt: updates.alt,
        caption: updates.caption ? {
          root: {
            type: 'root',
            children: [{
              type: 'paragraph',
              children: [{
                type: 'text',
                text: updates.caption
              }]
            }]
          }
        } : undefined
      })
    })

    if (!response.ok) {
      throw new Error('Failed to update media file')
    }
  }

  /**
   * Get files uploaded via messages (with message context)
   */
  static async getFilesFromMessages(spaceId: number = 1): Promise<ManagedFile[]> {
    // Get messages that have attachments
    const params = new URLSearchParams({
      where: JSON.stringify({
        and: [
          { space: { equals: spaceId } },
          { attachments: { exists: true } }
        ]
      }),
      limit: '100',
      sort: '-createdAt',
      populate: 'attachments'
    })

    const response = await fetch(`/api/messages?${params}`)
    
    if (!response.ok) {
      console.error('Failed to load message files')
      return []
    }

    const result = await response.json()
    const files: ManagedFile[] = []

    for (const message of result.docs) {
      if (message.attachments && Array.isArray(message.attachments)) {
        for (const attachment of message.attachments) {
          if (typeof attachment === 'object' && attachment.id) {
            files.push({
              id: attachment.id,
              filename: attachment.filename,
              originalName: attachment.filename,
              mimeType: attachment.mimeType,
              filesize: attachment.filesize,
              url: attachment.url,
              alt: attachment.alt,
              caption: attachment.caption?.root?.children?.[0]?.children?.[0]?.text || '',
              uploadedAt: attachment.createdAt,
              uploadedBy: message.sender?.id || 'Unknown',
              thumbnailUrl: attachment.sizes?.thumbnail?.url,
              messageId: message.id,
              spaceId
            })
          }
        }
      }
    }

    return files
  }

  /**
   * Get file usage statistics
   */
  static async getFileStats(spaceId: number = 1): Promise<{
    totalFiles: number
    totalSize: number
    fileTypes: Record<string, number>
    recentUploads: number
  }> {
    const files = await this.loadFiles(spaceId)
    
    const stats = {
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.filesize, 0),
      fileTypes: {} as Record<string, number>,
      recentUploads: 0
    }

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    for (const file of files) {
      // Count file types
      const extension = file.filename.split('.').pop()?.toLowerCase() || 'unknown'
      stats.fileTypes[extension] = (stats.fileTypes[extension] || 0) + 1

      // Count recent uploads
      if (new Date(file.uploadedAt) > weekAgo) {
        stats.recentUploads++
      }
    }

    return stats
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Get file type icon
   */
  static getFileTypeIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.startsWith('video/')) return '🎥'
    if (mimeType.startsWith('audio/')) return '🎵'
    if (mimeType.includes('pdf')) return '📄'
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📈'
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '🗜️'
    return '📁'
  }
}


