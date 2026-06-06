/**
 * Legacy Lexical list normalization (pure — no React/block imports so it's
 * cheaply unit-testable and safe to import anywhere).
 *
 * Content authored under the pre-3.x lexical serialization stores list nodes as
 * `unordered-list` / `ordered-list`. The current @payloadcms/richtext-lexical
 * renderer only registers the `list` node type and throws Lexical error #17
 * ("node not registered") on the legacy types — which surfaced as "unknown
 * node" / a render crash on older pages. We rewrite the legacy nodes in-flight
 * so all historical content renders. Pure: returns a new tree, the stored
 * document is never mutated. Safe to extend with more legacy mappings.
 */
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

export function normalizeLegacyLexicalNode<T>(node: T): T {
  if (!node || typeof node !== 'object') return node
  const n = node as Record<string, unknown>
  let next = n

  if (n.type === 'unordered-list' || n.type === 'ordered-list') {
    const ordered = n.type === 'ordered-list'
    next = {
      ...n,
      type: 'list',
      listType: (n.listType as string) || (ordered ? 'number' : 'bullet'),
      tag: (n.tag as string) || (ordered ? 'ol' : 'ul'),
      ...(ordered ? { start: (n.start as number) ?? 1 } : {}),
    }
  }

  if (Array.isArray((next as Record<string, unknown>).children)) {
    next = {
      ...next,
      children: ((next as Record<string, unknown>).children as unknown[]).map(
        normalizeLegacyLexicalNode,
      ),
    }
  }

  return next as T
}

export function normalizeLegacyEditorState(
  data: SerializedEditorState,
): SerializedEditorState {
  if (!data || typeof data !== 'object' || !('root' in data) || !data.root) return data
  return { ...data, root: normalizeLegacyLexicalNode(data.root) }
}
