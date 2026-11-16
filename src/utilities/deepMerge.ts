// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Scrub any enumerable properties accidentally or maliciously added to
 * `Object.prototype` (e.g. via a Server Action / Flight prototype-pollution
 * gadget such as `Object.prototype.overrideAccess = [...]`).
 *
 * In a clean JavaScript runtime `Object.keys(Object.prototype)` is always `[]`.
 * Any enumerable key on `Object.prototype` breaks Payload's `for (... in ...)`
 * query validators (`validateQueryPaths`, `sanitizeJoinQuery`).
 */
export function scrubObjectPrototype(): string[] {
  const polluted = Object.keys(Object.prototype)
  if (polluted.length > 0) {
    for (const key of polluted) {
      try {
        delete (Object.prototype as Record<string, unknown>)[key]
      } catch {
        // Ignore if non-configurable
      }
    }
  }
  return polluted
}

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export function isObject(item: unknown): item is object {
  return typeof item === 'object' && !Array.isArray(item)
}

/**
 * Deep merge two objects (hardened against prototype pollution).
 * @param target
 * @param ...sources
 */
export default function deepMerge<T, R>(target: T, source: R): T {
  const output = { ...target }
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (DANGEROUS_KEYS.has(key)) {
        return
      }
      if (isObject(source[key])) {
        if (!Object.prototype.hasOwnProperty.call(target, key)) {
          Object.assign(output, { [key]: source[key] })
        } else {
          output[key] = deepMerge(target[key], source[key])
        }
      } else {
        Object.assign(output, { [key]: source[key] })
      }
    })
  }

  return output
}

