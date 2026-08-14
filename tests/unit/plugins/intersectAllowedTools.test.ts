/**
 * The list can only ever NARROW what a caller's roles allow. A bug in the other
 * direction hands an API key tools its owner isn't entitled to, so that's the
 * case with a test on it.
 */
import { describe, it, expect } from 'vitest'
import { intersectAllowedTools } from '@/plugins/mcp'

const roleMap = { leoRespond: true, queryProducts: true, queryPosts: true } as Record<string, true>

describe('intersectAllowedTools', () => {
  it('empty list means "whatever your roles allow" — the previous behaviour', () => {
    expect(intersectAllowedTools(roleMap, [])).toEqual(roleMap)
    expect(intersectAllowedTools(roleMap, undefined)).toEqual(roleMap)
    expect(intersectAllowedTools(roleMap, null)).toEqual(roleMap)
  })

  it('narrows to the intersection, taking tool names in snake_case as stored', () => {
    expect(intersectAllowedTools(roleMap, ['query_products'])).toEqual({ queryProducts: true })
  })

  it('cannot widen: a listed tool the roles do not grant stays out', () => {
    expect(intersectAllowedTools(roleMap, ['query_products', 'delete_everything'])).toEqual({
      queryProducts: true,
    })
  })

  it('ignores junk in the list rather than throwing', () => {
    expect(intersectAllowedTools(roleMap, [42, null, 'query_posts'])).toEqual({ queryPosts: true })
  })
})
