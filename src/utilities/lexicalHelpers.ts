/**
 * Lexical Content Helpers
 *
 * These functions create lexical content structures that are 100% compatible
 * with the @payloadcms/richtext-lexical editor features.
 */

// Root lexical content structure
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createLexicalContent = (children: any[]): any => ({
  root: {
    type: 'root',
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1
  }
})

// Text node (used within paragraphs, headings, list items)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createTextNode = (text: string, format: number = 0): any => ({
  type: 'text',
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text,
  version: 1,
})

// Paragraph node - compatible with ParagraphFeature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createParagraphNode = (text: string, format: number = 0): any => ({
  type: 'paragraph',
  children: [createTextNode(text, format)],
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
})

// Heading node - compatible with HeadingFeature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createHeadingNode = (text: string, tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' = 'h2'): any => ({
  type: 'heading',
  children: [createTextNode(text)],
  direction: 'ltr',
  format: '',
  indent: 0,
  tag,
  version: 1,
})

// List item node - used within lists
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createListItemNode = (text: string): any => ({
  type: 'listitem',
  children: [createParagraphNode(text)],
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  value: 1,
})

// Unordered list node - compatible with UnorderedListFeature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createUnorderedListNode = (items: string[]): any => ({
  type: 'list',
  children: items.map(item => createListItemNode(item)),
  direction: 'ltr',
  format: '',
  indent: 0,
  listType: 'bullet',
  start: 1,
  tag: 'ul',
  version: 1
})

// Ordered list node - compatible with OrderedListFeature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createOrderedListNode = (items: string[]): any => ({
  type: 'list',
  children: items.map(item => createListItemNode(item)),
  direction: 'ltr',
  format: '',
  indent: 0,
  listType: 'number',
  start: 1,
  tag: 'ol',
  version: 1
})

// Convenience functions with legacy names for backward compatibility
export const createLexicalParagraph = createParagraphNode
export const createLexicalHeading = createHeadingNode
export const createLexicalList = (items: string[], listType: 'bullet' | 'number' = 'bullet') =>
  listType === 'bullet' ? createUnorderedListNode(items) : createOrderedListNode(items)

// Test function to validate lexical structure
export const validateLexicalContent = (content: unknown): { valid: boolean; errors: string[] } => {
  const errors: string[] = []
  const contentObj = content as Record<string, unknown>

  if (!contentObj?.root) {
    errors.push('Missing root node')
    return { valid: false, errors }
  }

  const root = contentObj.root as Record<string, unknown>

  if (root.type !== 'root') {
    errors.push('Root node must have type "root"')
  }

  if (!Array.isArray(root.children)) {
    errors.push('Root must have children array')
  }

  // Validate each child node
  const children = root.children as unknown[]
  children?.forEach((child: unknown, index: number) => {
    const childObj = child as Record<string, unknown>

    if (!childObj.type) {
      errors.push(`Child ${index} missing type property`)
    }

    if (!childObj.version) {
      errors.push(`Child ${index} missing version property`)
    }

    // Check for known node types
    const validTypes = ['paragraph', 'heading', 'unorderedlist', 'orderedlist', 'listitem', 'text']
    if (childObj.type && !validTypes.includes(childObj.type as string)) {
      errors.push(`Child ${index} has unknown type: ${childObj.type}`)
    }
  })

  return { valid: errors.length === 0, errors }
}

// Helper to create rich product descriptions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createProductDescription = (description: string, features: string[] = [], technicalDetails: string = ''): any => {
  const children = [
    createParagraphNode(description)
  ]

  if (features.length > 0) {
    children.push(createHeadingNode('Key Features', 'h3'))
    children.push(createUnorderedListNode(features))
  }

  if (technicalDetails) {
    children.push(createHeadingNode('Technical Details', 'h3'))
    children.push(createParagraphNode(technicalDetails))
  }

  return createLexicalContent(children)
}

// Helper to create service descriptions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createServiceDescription = (
  intro: string,
  services: string[] = [],
  benefits: string[] = [],
  process: string = ''
): any => {
  const children = [
    createParagraphNode(intro)
  ]

  if (services.length > 0) {
    children.push(createHeadingNode('Services Included', 'h3'))
    children.push(createUnorderedListNode(services))
  }

  if (benefits.length > 0) {
    children.push(createHeadingNode('Key Benefits', 'h3'))
    children.push(createUnorderedListNode(benefits))
  }

  if (process) {
    children.push(createHeadingNode('Our Process', 'h3'))
    children.push(createParagraphNode(process))
  }

  return createLexicalContent(children)
}
