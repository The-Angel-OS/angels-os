// Blog Import Service - Import posts from external sources like spaces.kendev.co

export interface ImportedPost {
  title: string
  slug: string
  content: string
  excerpt?: string
  publishedAt: string
  author?: string
  tags?: string[]
  categories?: string[]
  featuredImage?: {
    url: string
    alt?: string
  }
  metaData?: {
    description?: string
    ogImage?: string
    ogTitle?: string
    ogDescription?: string
  }
}

export class BlogImportService {
  /**
   * Import posts from spaces.kendev.co RSS/JSON feed
   */
  static async importFromSpacesKenDev(): Promise<ImportedPost[]> {
    try {
      console.log('📥 Importing posts from spaces.kendev.co...')
      
      // Try multiple endpoints to get posts
      const endpoints = [
        'https://spaces.kendev.co/api/posts',
        'https://spaces.kendev.co/feed.json',
        'https://spaces.kendev.co/posts.json'
      ]

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint)
          if (response.ok) {
            const data = await response.json()
            return this.parseSpacesData(data)
          }
        } catch (error) {
          console.log(`Failed to fetch from ${endpoint}:`, error)
        }
      }

      // Fallback: Try to scrape the site
      return await this.scrapeSpacesKenDev()
    } catch (error) {
      console.error('Failed to import from spaces.kendev.co:', error)
      return []
    }
  }

  /**
   * Parse data from spaces.kendev.co API
   */
  private static parseSpacesData(data: any): ImportedPost[] {
    const posts: ImportedPost[] = []
    
    // Handle different data formats
    if (data.docs && Array.isArray(data.docs)) {
      // Payload CMS format
      for (const post of data.docs) {
        posts.push(this.convertPayloadPost(post))
      }
    } else if (data.items && Array.isArray(data.items)) {
      // JSON Feed format
      for (const item of data.items) {
        posts.push(this.convertJSONFeedItem(item))
      }
    } else if (Array.isArray(data)) {
      // Simple array format
      for (const post of data) {
        posts.push(this.convertGenericPost(post))
      }
    }

    return posts
  }

  /**
   * Convert Payload CMS post to ImportedPost
   */
  private static convertPayloadPost(post: any): ImportedPost {
    return {
      title: post.title || 'Untitled',
      slug: post.slug || this.generateSlug(post.title),
      content: this.extractContent(post.content),
      excerpt: post.excerpt || this.generateExcerpt(post.content),
      publishedAt: post.publishedAt || post.createdAt || new Date().toISOString(),
      author: post.author?.name || 'Kenneth Courtney',
      tags: post.tags?.map((tag: any) => tag.name || tag) || [],
      categories: post.categories?.map((cat: any) => cat.name || cat) || [],
      featuredImage: post.featuredImage ? {
        url: post.featuredImage.url,
        alt: post.featuredImage.alt
      } : undefined,
      metaData: {
        description: post.meta?.description,
        ogImage: post.meta?.image?.url,
        ogTitle: post.meta?.title,
        ogDescription: post.meta?.description
      }
    }
  }

  /**
   * Convert JSON Feed item to ImportedPost
   */
  private static convertJSONFeedItem(item: any): ImportedPost {
    return {
      title: item.title || 'Untitled',
      slug: this.generateSlug(item.title),
      content: item.content_html || item.content_text || '',
      excerpt: item.summary,
      publishedAt: item.date_published || new Date().toISOString(),
      author: item.author?.name || 'Kenneth Courtney',
      tags: item.tags || [],
      featuredImage: item.image ? {
        url: item.image,
        alt: item.title
      } : undefined
    }
  }

  /**
   * Convert generic post object to ImportedPost
   */
  private static convertGenericPost(post: any): ImportedPost {
    return {
      title: post.title || post.name || 'Untitled',
      slug: post.slug || this.generateSlug(post.title || post.name),
      content: post.content || post.body || post.description || '',
      publishedAt: post.publishedAt || post.published || post.date || new Date().toISOString(),
      author: post.author || 'Kenneth Courtney'
    }
  }

  /**
   * Scrape spaces.kendev.co if no API available
   */
  private static async scrapeSpacesKenDev(): Promise<ImportedPost[]> {
    // This would implement web scraping as fallback
    console.log('🕷️ Web scraping not implemented yet')
    return []
  }

  /**
   * Extract content from Lexical/rich text format
   */
  private static extractContent(content: any): string {
    if (typeof content === 'string') return content
    
    if (content?.root?.children) {
      // Lexical format
      return this.extractLexicalText(content.root.children)
    }
    
    return JSON.stringify(content)
  }

  /**
   * Extract text from Lexical nodes
   */
  private static extractLexicalText(children: any[]): string {
    let text = ''
    
    for (const child of children) {
      if (child.type === 'text') {
        text += child.text
      } else if (child.children) {
        text += this.extractLexicalText(child.children)
      }
      if (child.type === 'paragraph') {
        text += '\n\n'
      }
    }
    
    return text.trim()
  }

  /**
   * Generate slug from title
   */
  private static generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  /**
   * Generate excerpt from content
   */
  private static generateExcerpt(content: string, maxLength: number = 160): string {
    const text = typeof content === 'string' ? content : this.extractContent(content)
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  /**
   * Import posts into Payload CMS
   */
  static async importPosts(posts: ImportedPost[], tenantId: string): Promise<void> {
    console.log(`📥 Importing ${posts.length} posts...`)
    
    for (const post of posts) {
      try {
        // Check if post already exists
        const response = await fetch('/api/posts', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (response.ok) {
          const existingPosts = await response.json()
          const exists = existingPosts.docs?.some((p: any) => p.slug === post.slug)
          
          if (exists) {
            console.log(`⏭️ Post "${post.title}" already exists, skipping`)
            continue
          }
        }

        // Create the post
        const createResponse = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: post.title,
            slug: post.slug,
            content: this.contentToLexical(post.content),
            excerpt: post.excerpt,
            publishedAt: post.publishedAt,
            _status: 'published',
            meta: post.metaData
          })
        })

        if (createResponse.ok) {
          console.log(`✅ Imported: "${post.title}"`)
        } else {
          console.error(`❌ Failed to import: "${post.title}"`)
        }
      } catch (error) {
        console.error(`❌ Error importing "${post.title}":`, error)
      }
    }
  }

  /**
   * Convert plain text to Lexical format
   */
  private static contentToLexical(content: string): any {
    const paragraphs = content.split('\n\n').filter(p => p.trim())
    
    return {
      root: {
        type: 'root',
        version: 1,
        children: paragraphs.map(paragraph => ({
          type: 'paragraph',
          version: 1,
          children: [{
            type: 'text',
            text: paragraph.trim(),
            version: 1
          }]
        }))
      }
    }
  }
}
