/**
 * Documentation Endpoint — GET /api/docs
 *
 * Serves markdown and text files from the `docs/` directory for the
 * Documentation Center page.
 *
 * Query params:
 *   ?action=list          — List all .md and .txt files with metadata
 *   ?action=read&file=X   — Read a specific document file
 */

import type { PayloadHandler } from 'payload'
import { readdir, readFile, stat } from 'fs/promises'
import { join, relative, extname } from 'path'

interface DocFile {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  size?: number
  lastModified?: Date
  content?: string
  metadata?: {
    title?: string
    description?: string
    lastUpdated?: string
  }
}

const DOCS_DIR = join(process.cwd(), 'docs')

function extractMarkdownMetadata(content: string): {
  title?: string
  description?: string
  lastUpdated?: string
} {
  const metadata: { title?: string; description?: string; lastUpdated?: string } = {}

  // Extract title from first H1
  const titleMatch = content.match(/^#\s+(.+)$/m)
  if (titleMatch) {
    metadata.title = titleMatch[1]?.trim()
  }

  // Extract description from first paragraph after title
  const lines = content.split('\n')
  let foundTitle = false
  for (const line of lines) {
    if (line.startsWith('# ')) {
      foundTitle = true
      continue
    }
    if (
      foundTitle &&
      line.trim() &&
      !line.startsWith('#') &&
      !line.startsWith('*') &&
      !line.startsWith('-')
    ) {
      metadata.description =
        line.trim().substring(0, 150) + (line.length > 150 ? '...' : '')
      break
    }
  }

  // Extract last updated date if present
  const lastUpdatedMatch = content.match(/\*Last Updated[:\s]+([^*\n]+)\*/i)
  if (lastUpdatedMatch) {
    metadata.lastUpdated = lastUpdatedMatch[1]?.trim()
  }

  return metadata
}

async function scanDirectory(
  dirPath: string,
  baseDir: string = dirPath,
): Promise<DocFile[]> {
  const files: DocFile[] = []

  try {
    const entries = await readdir(dirPath)

    for (const entry of entries) {
      const fullPath = join(dirPath, entry)
      const stats = await stat(fullPath)
      const relativePath = relative(baseDir, fullPath)

      if (stats.isDirectory()) {
        if (!entry.startsWith('.') && entry !== 'node_modules') {
          files.push({
            name: entry,
            path: fullPath,
            relativePath,
            isDirectory: true,
            lastModified: stats.mtime,
          })
          const subFiles = await scanDirectory(fullPath, baseDir)
          files.push(...subFiles)
        }
      } else if (['.md', '.txt'].includes(extname(entry).toLowerCase())) {
        const content = await readFile(fullPath, 'utf-8')
        const metadata = extractMarkdownMetadata(content)

        files.push({
          name: entry,
          path: fullPath,
          relativePath,
          isDirectory: false,
          size: stats.size,
          lastModified: stats.mtime,
          content: metadata.title || entry.replace(/\.(md|txt)$/, ''),
          metadata,
        })
      }
    }

    return files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })
  } catch (error) {
    console.error(`[Docs API] Failed to scan directory ${dirPath}:`, error)
    return []
  }
}

export const docsHandler: PayloadHandler = async (req) => {
  try {
    const url = new URL(req.url || '', 'http://localhost')
    const action = url.searchParams.get('action')
    const filePath = url.searchParams.get('file')

    switch (action) {
      case 'list': {
        const files = await scanDirectory(DOCS_DIR)
        return Response.json({
          success: true,
          docs: files,
          totalFiles: files.length,
          lastScanned: new Date().toISOString(),
        })
      }

      case 'read': {
        if (!filePath) {
          return Response.json(
            { error: 'File path is required for read action' },
            { status: 400 },
          )
        }

        // Security: ensure file stays within docs directory
        const fullPath = join(DOCS_DIR, filePath)
        const rel = relative(DOCS_DIR, fullPath)
        if (rel.startsWith('..') || !rel) {
          return Response.json({ error: 'Invalid file path' }, { status: 400 })
        }

        const stats = await stat(fullPath)
        if (!stats.isFile() || !['.md', '.txt'].includes(extname(fullPath).toLowerCase())) {
          return Response.json(
            { error: 'File not found or not a supported document' },
            { status: 404 },
          )
        }

        const content = await readFile(fullPath, 'utf-8')
        const metadata = extractMarkdownMetadata(content)

        return Response.json({
          success: true,
          file: {
            name: filePath.split('/').pop() || filePath,
            path: fullPath,
            relativePath: filePath,
            content,
            size: stats.size,
            lastModified: stats.mtime,
            metadata,
          },
        })
      }

      default:
        return Response.json({
          success: true,
          message: 'Documentation API',
          endpoints: {
            'GET ?action=list': 'List all documentation files',
            'GET ?action=read&file=path': 'Read specific documentation file',
          },
        })
    }
  } catch (error) {
    console.error('[Docs API] Error:', error)
    return Response.json(
      { error: 'Documentation API failed' },
      { status: 500 },
    )
  }
}
