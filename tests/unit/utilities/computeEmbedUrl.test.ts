/**
 * computeEmbedUrl — Unit Tests
 *
 * Pure function with no external dependencies. Tests URL parsing for
 * YouTube, Vimeo, Twitch, and custom video URLs.
 */
import { describe, it, expect } from 'vitest'
import { computeEmbedUrl } from '@/utilities/computeEmbedUrl'

describe('computeEmbedUrl', () => {
  // ── Edge cases ──────────────────────────────────────────────────────────

  it('returns null embedUrl for empty string', () => {
    const result = computeEmbedUrl('')
    expect(result.embedUrl).toBeNull()
    expect(result.videoId).toBeNull()
    expect(result.provider).toBe('custom')
  })

  it('returns null embedUrl for whitespace-only string', () => {
    const result = computeEmbedUrl('   ')
    expect(result.embedUrl).toBeNull()
    expect(result.videoId).toBeNull()
  })

  it('returns null embedUrl for non-string input', () => {
    // TypeScript would catch this, but handle at runtime too
    const result = computeEmbedUrl(null as unknown as string)
    expect(result.embedUrl).toBeNull()
  })

  it('uses providerHint when no URL matches', () => {
    const result = computeEmbedUrl('', 'vimeo')
    expect(result.provider).toBe('vimeo')
  })

  // ── YouTube ─────────────────────────────────────────────────────────────

  it('parses standard YouTube watch URL', () => {
    const result = computeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(result.provider).toBe('youtube')
    expect(result.videoId).toBe('dQw4w9WgXcQ')
    expect(result.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
  })

  it('parses YouTube watch URL with extra query params', () => {
    const result = computeEmbedUrl('https://www.youtube.com/watch?t=42&v=dQw4w9WgXcQ&list=PL123')
    expect(result.provider).toBe('youtube')
    expect(result.videoId).toBe('dQw4w9WgXcQ')
  })

  it('parses youtu.be short URL', () => {
    const result = computeEmbedUrl('https://youtu.be/dQw4w9WgXcQ')
    expect(result.provider).toBe('youtube')
    expect(result.videoId).toBe('dQw4w9WgXcQ')
    expect(result.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
  })

  it('parses existing YouTube embed URL (idempotent)', () => {
    const result = computeEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')
    expect(result.provider).toBe('youtube')
    expect(result.videoId).toBe('dQw4w9WgXcQ')
    expect(result.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
  })

  it('handles YouTube video IDs with underscores and hyphens', () => {
    const result = computeEmbedUrl('https://youtu.be/abc-def_ghi')
    expect(result.provider).toBe('youtube')
    expect(result.videoId).toBe('abc-def_ghi')
  })

  // ── Vimeo ───────────────────────────────────────────────────────────────

  it('parses vimeo.com URL', () => {
    const result = computeEmbedUrl('https://vimeo.com/123456789')
    expect(result.provider).toBe('vimeo')
    expect(result.videoId).toBe('123456789')
    expect(result.embedUrl).toBe('https://player.vimeo.com/video/123456789')
  })

  it('parses player.vimeo.com URL (idempotent)', () => {
    const result = computeEmbedUrl('https://player.vimeo.com/video/987654321')
    expect(result.provider).toBe('vimeo')
    expect(result.videoId).toBe('987654321')
    expect(result.embedUrl).toBe('https://player.vimeo.com/video/987654321')
  })

  it('parses vimeo.com URL with trailing slash', () => {
    const result = computeEmbedUrl('https://vimeo.com/123456/')
    expect(result.provider).toBe('vimeo')
    expect(result.videoId).toBe('123456')
  })

  // ── Twitch ──────────────────────────────────────────────────────────────

  it('parses Twitch channel URL', () => {
    const result = computeEmbedUrl('https://www.twitch.tv/clearwaterangels')
    expect(result.provider).toBe('twitch')
    expect(result.videoId).toBe('clearwaterangels')
    expect(result.embedUrl).toContain('player.twitch.tv')
    expect(result.embedUrl).toContain('channel=clearwaterangels')
  })

  it('parses Twitch video (VOD) URL', () => {
    const result = computeEmbedUrl('https://www.twitch.tv/videos/9876543210')
    expect(result.provider).toBe('twitch')
    expect(result.videoId).toBe('9876543210')
    expect(result.embedUrl).toContain('player.twitch.tv')
    expect(result.embedUrl).toContain('video=v9876543210')
  })

  it('includes parent domain in Twitch embed URL', () => {
    // In Node/jsdom environment, window.location.hostname may be undefined → fallback 'localhost'
    const result = computeEmbedUrl('https://www.twitch.tv/testchannel')
    expect(result.embedUrl).toContain('parent=')
  })

  // ── Custom / pass-through ────────────────────────────────────────────────

  it('passes custom URLs through unchanged', () => {
    const customUrl = 'https://cdn.example.com/video/my-video.mp4'
    const result = computeEmbedUrl(customUrl)
    expect(result.provider).toBe('custom')
    expect(result.embedUrl).toBe(customUrl)
    expect(result.videoId).toBeNull()
  })

  it('uses providerHint for custom URL when provided', () => {
    const customUrl = 'https://cdn.example.com/video/my-video.mp4'
    const result = computeEmbedUrl(customUrl, 'vimeo')
    expect(result.provider).toBe('vimeo')
    expect(result.embedUrl).toBe(customUrl)
  })

  it('trims whitespace from input URL', () => {
    const result = computeEmbedUrl('  https://youtu.be/dQw4w9WgXcQ  ')
    expect(result.provider).toBe('youtube')
    expect(result.videoId).toBe('dQw4w9WgXcQ')
  })
})
