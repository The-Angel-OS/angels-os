/**
 * messageRevisions — a message is an append-only revision log.
 *
 * The elegant unification: an EDIT and a moderator REDACTION are the same act —
 * a new revision. `content` always holds the latest visible version; the prior
 * versions live in `metadata.revisions[]`, ad infinitum. One mechanism, two
 * behaviors (the editor being someone other than the author = a moderation act).
 *
 * Tamper-resistance is the load-bearing property: the history is ALWAYS rebuilt
 * from the server's previous revisions, never from client-supplied metadata — so
 * no one can edit a message and quietly rewrite or erase its lineage.
 *
 * Pure: the hook does the IO (read the previous doc, resolve the editor); this
 * just folds a new revision into the metadata. Trivially testable.
 */

export interface MessageRevision {
  /** The PRIOR content value (whatever shape `content` had — string or UMS JSON). */
  content: unknown
  /** ISO timestamp of when this prior version was superseded. */
  editedAt: string
  /** The user who made the edit that superseded this version. */
  editedBy: string | number | null
  /** True when the editor was NOT the original author — a moderation action. */
  moderation?: boolean
}

export interface RevisionMeta {
  revisions?: MessageRevision[]
  edited?: boolean
  editedAt?: string
  editedBy?: string | number | null
  /** True once any moderator (non-author) has edited/redacted the message. */
  moderated?: boolean
  [k: string]: unknown
}

/**
 * Fold a new revision into a message's metadata, preserving every other metadata
 * key. `prevRevisions` is the AUTHORITATIVE history (read from the stored doc) —
 * it overrides whatever the caller put in `incomingMeta.revisions`, so the log is
 * append-only and cannot be forged or truncated by a client.
 */
export function appendRevision(
  incomingMeta: RevisionMeta | null | undefined,
  prevRevisions: MessageRevision[] | null | undefined,
  args: {
    previousContent: unknown
    editedBy: string | number | null
    moderation: boolean
    now: string
  },
): RevisionMeta {
  const base = incomingMeta && typeof incomingMeta === 'object' ? { ...incomingMeta } : {}
  const history = Array.isArray(prevRevisions) ? [...prevRevisions] : []

  history.push({
    content: args.previousContent,
    editedAt: args.now,
    editedBy: args.editedBy,
    ...(args.moderation ? { moderation: true } : {}),
  })

  return {
    ...base,
    revisions: history, // authoritative — overrides any client-supplied value
    edited: true,
    editedAt: args.now,
    editedBy: args.editedBy,
    ...(args.moderation ? { moderated: true } : {}),
  }
}

/** Structural inequality for `content` (string or UMS JSON). */
export function contentsDiffer(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) !== JSON.stringify(b)
  } catch {
    return a !== b
  }
}
