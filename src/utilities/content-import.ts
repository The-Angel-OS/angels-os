import { getPayload } from 'payload'
import config from '@payload-config'

interface ExternalPost {
  id: string
  title: string
  slug: string
  content?: any
  status: 'draft' | 'published'
  publishedAt?: string
  createdAt: string
  updatedAt: string
  authors?: Array<{
    id: string
    firstName?: string
    lastName?: string
    email?: string
  }>
  categories?: Array<{
    id: string
    name: string
    slug: string
  }>
  heroImage?: {
    id: string
    url: string
    alt?: string
    filename: string
  }
  meta?: {
    title?: string
    description?: string
    keywords?: string
  }
}

interface ImportOptions {
  sourceUrl: string
  authorFilter?: string
  categoryFilter?: string
  dateRange?: {
    from: string
    to: string
  }
  tenantId?: number
  dryRun?: boolean
  batchSize?: number
}

interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: Array<{
    post: string
    error: string
  }>
  summary: {
    totalFound: number
    totalProcessed: number
    duplicatesSkipped: number
  }
}

/**
 * Import posts from external Payload CMS instance
 * Supports importing from spaces.kendev.co or any Payload 3.0 instance
 */
export async function importPostsFromExternal(options: ImportOptions): Promise<ImportResult> {
  const {
    sourceUrl,
    authorFilter,
    categoryFilter,
    dateRange,
    tenantId,
    dryRun = false,
    batchSize = 10
  } = options

  const payload = await getPayload({ config })
  
  const result: ImportResult = {
    success: false,
    imported: 0,
    skipped: 0,
    errors: [],
    summary: {
      totalFound: 0,
      totalProcessed: 0,
      duplicatesSkipped: 0
    }
  }

  try {
    console.log(`🔍 Starting import from ${sourceUrl}`)
    
    // Build query parameters
    const queryParams = new URLSearchParams()
    queryParams.append('limit', '100')
    queryParams.append('depth', '2')
    
    if (authorFilter) {
      queryParams.append('where[authors.email][equals]', authorFilter)
    }
    
    if (categoryFilter) {
      queryParams.append('where[categories.slug][equals]', categoryFilter)
    }
    
    if (dateRange) {
      queryParams.append('where[createdAt][greater_than_equal]', dateRange.from)
      queryParams.append('where[createdAt][less_than_equal]', dateRange.to)
    }

    // Fetch posts from external API
    const apiUrl = `${sourceUrl}/api/posts?${queryParams.toString()}`
    console.log(`📡 Fetching from: ${apiUrl}`)
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Angel-OS-Import/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const externalPosts: ExternalPost[] = data.docs || []
    
    result.summary.totalFound = externalPosts.length
    console.log(`📄 Found ${externalPosts.length} posts to process`)

    if (externalPosts.length === 0) {
      console.log('ℹ️  No posts found matching criteria')
      result.success = true
      return result
    }

    // Process posts in batches
    for (let i = 0; i < externalPosts.length; i += batchSize) {
      const batch = externalPosts.slice(i, i + batchSize)
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(externalPosts.length / batchSize)}`)
      
      for (const externalPost of batch) {
        try {
          const importResult = await importSinglePost(payload, externalPost, tenantId, dryRun, sourceUrl)
          
          if (importResult.imported) {
            result.imported++
          } else {
            result.skipped++
            if (importResult.reason === 'duplicate') {
              result.summary.duplicatesSkipped++
            }
          }
          
          result.summary.totalProcessed++
          
        } catch (error) {
          console.error(`❌ Error importing post "${externalPost.title}":`, error)
          result.errors.push({
            post: externalPost.title,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
      
      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < externalPosts.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    result.success = result.errors.length === 0
    
    console.log(`✅ Import completed:`)
    console.log(`   📥 Imported: ${result.imported}`)
    console.log(`   ⏭️  Skipped: ${result.skipped}`)
    console.log(`   ❌ Errors: ${result.errors.length}`)
    
    return result

  } catch (error) {
    console.error('💥 Import failed:', error)
    result.errors.push({
      post: 'IMPORT_PROCESS',
      error: error instanceof Error ? error.message : String(error)
    })
    return result
  }
}

/**
 * Import a single post with duplicate detection and media handling
 */
async function importSinglePost(
  payload: any,
  externalPost: ExternalPost,
  tenantId?: number,
  dryRun: boolean = false,
  sourceUrl: string = ''
): Promise<{ imported: boolean; reason?: string }> {
  
  // Check for existing post by slug
  const existingPosts = await payload.find({
    collection: 'posts',
    where: {
      slug: { equals: externalPost.slug }
    },
    limit: 1
  })

  if (existingPosts.docs.length > 0) {
    console.log(`⏭️  Skipping duplicate: ${externalPost.title}`)
    return { imported: false, reason: 'duplicate' }
  }

  if (dryRun) {
    console.log(`🧪 DRY RUN: Would import "${externalPost.title}"`)
    return { imported: true, reason: 'dry-run' }
  }

  // Handle author mapping
  let authorId = 1 // Default to system user
  if (externalPost.authors && externalPost.authors.length > 0) {
    const externalAuthor = externalPost.authors[0]
    
    if (externalAuthor?.email) {
      // Try to find existing user by email
      const existingUsers = await payload.find({
        collection: 'users',
        where: {
          email: { equals: externalAuthor?.email }
        },
        limit: 1
      })

      if (existingUsers.docs.length > 0) {
        authorId = existingUsers.docs[0].id
      } else {
        // Create new user if needed
        try {
          const newUser = await payload.create({
            collection: 'users',
            data: {
              firstName: externalAuthor?.firstName || 'Imported',
              lastName: externalAuthor?.lastName || 'Author',
              email: externalAuthor?.email || '',
              password: 'temp-password-' + Date.now(),
              globalRole: 'user',
              tenant: tenantId
            }
          })
          authorId = newUser.id
          console.log(`👤 Created new author: ${externalAuthor?.email}`)
        } catch (error) {
          console.warn(`⚠️  Could not create author ${externalAuthor?.email}, using default`)
        }
      }
    }
  }

  // Handle hero image import
  let heroImageId = null
  if (externalPost.heroImage) {
    try {
      heroImageId = await importMedia(payload, externalPost.heroImage, sourceUrl, tenantId)
    } catch (error) {
      console.warn(`⚠️  Could not import hero image for "${externalPost.title}":`, error)
    }
  }

  // Handle categories
  const categoryIds: string[] = []
  if (externalPost.categories) {
    for (const externalCategory of externalPost.categories) {
      try {
        let categoryId = await findOrCreateCategory(payload, externalCategory, tenantId)
        if (categoryId) {
          categoryIds.push(categoryId)
        }
      } catch (error) {
        console.warn(`⚠️  Could not handle category "${externalCategory.name}":`, error)
      }
    }
  }

  // Create the post
  const postData = {
    title: externalPost.title,
    slug: externalPost.slug,
    content: externalPost.content || createDefaultContent(externalPost.title),
    status: externalPost.status,
    publishedAt: externalPost.publishedAt,
    authors: [authorId],
    categories: categoryIds,
    heroImage: heroImageId,
    tenant: tenantId,
    meta: {
      title: externalPost.meta?.title || externalPost.title,
      description: externalPost.meta?.description || `Imported post: ${externalPost.title}`,
      keywords: externalPost.meta?.keywords || ''
    },
    // Mark as imported for tracking
    importMetadata: {
      sourceUrl,
      sourceId: externalPost.id,
      importedAt: new Date().toISOString(),
      originalCreatedAt: externalPost.createdAt,
      originalUpdatedAt: externalPost.updatedAt
    }
  }

  const newPost = await payload.create({
    collection: 'posts',
    data: postData
  })

  console.log(`✅ Imported: "${externalPost.title}" (ID: ${newPost.id})`)
  return { imported: true }
}

/**
 * Import media from external URL
 */
async function importMedia(
  payload: any,
  externalMedia: any,
  sourceUrl: string,
  tenantId?: number
): Promise<string | null> {
  
  // Check if media already exists by filename
  const existingMedia = await payload.find({
    collection: 'media',
    where: {
      filename: { equals: externalMedia.filename }
    },
    limit: 1
  })

  if (existingMedia.docs.length > 0) {
    return existingMedia.docs[0].id
  }

  // Download the media file
  const mediaUrl = externalMedia.url.startsWith('http') 
    ? externalMedia.url 
    : `${sourceUrl}${externalMedia.url}`

  try {
    const response = await fetch(mediaUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch media: ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    const file = {
      name: externalMedia.filename,
      data: Buffer.from(buffer),
      mimetype: response.headers.get('content-type') || 'image/jpeg',
      size: buffer.byteLength
    }

    const newMedia = await payload.create({
      collection: 'media',
      data: {
        alt: externalMedia.alt || externalMedia.filename,
        tenant: tenantId
      },
      file
    })

    console.log(`🖼️  Imported media: ${externalMedia.filename}`)
    return newMedia.id

  } catch (error) {
    console.error(`❌ Failed to import media ${externalMedia.filename}:`, error)
    return null
  }
}

/**
 * Find or create category
 */
async function findOrCreateCategory(
  payload: any,
  externalCategory: any,
  tenantId?: number
): Promise<string | null> {
  
  // Try to find existing category
  const existingCategories = await payload.find({
    collection: 'categories',
    where: {
      slug: { equals: externalCategory.slug }
    },
    limit: 1
  })

  if (existingCategories.docs.length > 0) {
    return existingCategories.docs[0].id
  }

  // Create new category
  try {
    const newCategory = await payload.create({
      collection: 'categories',
      data: {
        name: externalCategory.name,
        slug: externalCategory.slug,
        tenant: tenantId
      }
    })

    console.log(`📁 Created category: ${externalCategory.name}`)
    return newCategory.id

  } catch (error) {
    console.error(`❌ Failed to create category ${externalCategory.name}:`, error)
    return null
  }
}

/**
 * Create default Lexical content for posts without content
 */
function createDefaultContent(title: string) {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text: `This post "${title}" was imported from an external source. The original content structure may need to be reviewed and updated.`,
              version: 1
            }
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1
        }
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1
    }
  }
}

/**
 * Utility function for YouTube/Rumble channel content analysis
 */
export async function analyzeChannelContent(channelUrl: string): Promise<{
  channelInfo: any
  recentVideos: any[]
  contentThemes: string[]
  suggestedCategories: string[]
}> {
  // This would integrate with YouTube/Rumble APIs
  // For now, return mock data structure
  
  console.log(`🎥 Analyzing channel: ${channelUrl}`)
  
  return {
    channelInfo: {
      name: 'Channel Name',
      description: 'Channel description',
      subscriberCount: 0,
      videoCount: 0
    },
    recentVideos: [],
    contentThemes: ['technology', 'business', 'automation'],
    suggestedCategories: ['AI Integration', 'Business Automation', 'Technology']
  }
}

/**
 * CLI-friendly import function
 */
export async function runImport(options: ImportOptions) {
  console.log('🚀 Starting Angel OS Content Import')
  console.log('=====================================')
  
  const result = await importPostsFromExternal(options)
  
  console.log('\n📊 Import Summary:')
  console.log('=================')
  console.log(`Success: ${result.success}`)
  console.log(`Total Found: ${result.summary.totalFound}`)
  console.log(`Imported: ${result.imported}`)
  console.log(`Skipped: ${result.skipped} (${result.summary.duplicatesSkipped} duplicates)`)
  console.log(`Errors: ${result.errors.length}`)
  
  if (result.errors.length > 0) {
    console.log('\n❌ Errors:')
    result.errors.forEach(error => {
      console.log(`  - ${error.post}: ${error.error}`)
    })
  }
  
  return result
}
