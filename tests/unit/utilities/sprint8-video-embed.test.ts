/**
 * Sprint 8 — Video Embed URL Parsing Tests
 *
 * Tests computeEmbedUrl() for YouTube, Vimeo, Twitch, and custom URLs.
 */
import { describe, it, expect } from 'vitest'
import { computeEmbedUrl } from '@/utilities/computeEmbedUrl'

describe('computeEmbedUrl', () => {
  // ─── YouTube ───────────────────────────────────────────────
  describe('YouTube', () => {
    it('parses standard watch URL', () => {
      const result = computeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(result.provider).toBe('youtube')
      expect(result.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
      expect(result.videoId).toBe('dQw4w9WgXcQ')
    })

    it('parses short URL (youtu.be)', () => {
      const result = computeEmbedUrl('https://youtu.be/dQw4w9WgXcQ')
      expect(result.provider).toBe('youtube')
      expect(result.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
      expect(result.videoId).toBe('dQw4w9WgXcQ')
    })

    it('parses existing embed URL', () => {
      const result = computeEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')
      expect(result.provider).toBe('youtube')
      expect(result.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
      expect(result.videoId).toBe('dQw4w9WgXcQ')
    })

    it('parses watch URL with extra params', () => {
      const result = computeEmbedUrl(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
      )
      expect(result.provider).toBe('youtube')
      expect(result.videoId).toBe('dQw4w9WgXcQ')
    })

    it('handles YouTube URL with http (no s)', () => {
      const result = computeEmbedUrl('http://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(result.provider).toBe('youtube')
      expect(result.videoId).toBe('dQw4w9WgXcQ')
    })
  })

  // ─── Vimeo ─────────────────────────────────────────────────
  describe('Vimeo', () => {
    it('parses standard Vimeo URL', () => {
      const result = computeEmbedUrl('https://vimeo.com/123456789')
      expect(result.provider).toBe('vimeo')
      expect(result.embedUrl).toBe('https://player.vimeo.com/video/123456789')
      expect(result.videoId).toBe('123456789')
    })

    it('parses existing Vimeo embed URL', () => {
      const result = computeEmbedUrl('https://player.vimeo.com/video/123456789')
      expect(result.provider).toBe('vimeo')
      expect(result.embedUrl).toBe('https://player.vimeo.com/video/123456789')
      expect(result.videoId).toBe('123456789')
    })
  })

  // ─── Twitch ────────────────────────────────────────────────
  describe('Twitch', () => {
    it('parses Twitch channel URL', () => {
      const result = computeEmbedUrl('https://www.twitch.tv/ninja')
      expect(result.provider).toBe('twitch')
      expect(result.embedUrl).toContain('channel=ninja')
      expect(result.videoId).toBe('ninja')
    })

    it('parses Twitch VOD URL', () => {
      const result = computeEmbedUrl('https://www.twitch.tv/videos/123456789')
      expect(result.provider).toBe('twitch')
      expect(result.embedUrl).toContain('video=v123456789')
      expect(result.videoId).toBe('123456789')
    })
  })

  // ─── Custom / Fallback ────────────────────────────────────
  describe('Custom / Fallback', () => {
    it('passes through unknown URLs', () => {
      const result = computeEmbedUrl('https://example.com/my-video.mp4')
      expect(result.provider).toBe('custom')
      expect(result.embedUrl).toBe('https://example.com/my-video.mp4')
      expect(result.videoId).toBeNull()
    })

    it('uses provider hint for unknown URLs', () => {
      const result = computeEmbedUrl('https://example.com/stream', 'custom')
      expect(result.provider).toBe('custom')
    })

    it('handles empty string', () => {
      const result = computeEmbedUrl('')
      expect(result.embedUrl).toBeNull()
    })

    it('handles whitespace-only string', () => {
      const result = computeEmbedUrl('   ')
      expect(result.embedUrl).toBeNull()
    })
  })

  // ─── Malformed URLs ───────────────────────────────────────
  describe('Malformed URLs', () => {
    it('handles YouTube URL with no video ID', () => {
      const result = computeEmbedUrl('https://www.youtube.com/watch?v=')
      expect(result.provider).toBe('custom')
      expect(result.videoId).toBeNull()
    })

    it('handles just a domain', () => {
      const result = computeEmbedUrl('https://youtube.com')
      expect(result.provider).toBe('custom')
    })

    it('handles plain text (not a URL)', () => {
      const result = computeEmbedUrl('not a url at all')
      expect(result.provider).toBe('custom')
      expect(result.embedUrl).toBe('not a url at all')
    })
  })
})
