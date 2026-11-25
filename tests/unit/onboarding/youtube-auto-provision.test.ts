import { describe, expect, it } from 'vitest'
import {
  buildTaglineFromDescription,
  extractChannelMetaFromHtml,
  normalizeYouTubeHandle,
  parseYouTubeChannelInput,
} from '@/utilities/youtubeChannelResolver'

describe('Sprint C2 (Part 2) — YouTube Channel Resolver', () => {
  it('parses @handle URLs, bare handles, /c/ custom URLs, and UC channel IDs', () => {
    const atUrl = parseYouTubeChannelInput('https://www.youtube.com/@ClearwaterCruisin')
    expect(atUrl.handle).toBe('@ClearwaterCruisin')
    expect(atUrl.suggestedSlug).toBe('clearwatercruisin')
    expect(atUrl.fetchUrl).toBe('https://www.youtube.com/@ClearwaterCruisin')

    const bareAt = parseYouTubeChannelInput('@My_Lunch_Break')
    expect(bareAt.handle).toBe('@My_Lunch_Break')
    expect(bareAt.suggestedSlug).toBe('my-lunch-break')

    const ucId = parseYouTubeChannelInput('UCdOAHfkg7LcKLlzpD8Spydw')
    expect(ucId.channelId).toBe('UCdOAHfkg7LcKLlzpD8Spydw')
    expect(ucId.fetchUrl).toBe('https://www.youtube.com/channel/UCdOAHfkg7LcKLlzpD8Spydw')

    const customUrl = parseYouTubeChannelInput('https://youtube.com/c/AngelOSCreators')
    expect(customUrl.suggestedSlug).toBe('angeloscreators')
    expect(customUrl.fetchUrl).toBe('https://www.youtube.com/c/AngelOSCreators')
  })

  it('normalizes handles to valid 3-32 char lowercase slugs', () => {
    expect(normalizeYouTubeHandle('@@Cool__Creator!!')).toBe('cool-creator')
    expect(normalizeYouTubeHandle('---test---')).toBe('test')
  })

  it('extracts channelId, title, description, avatarUrl, and bannerUrl from YouTube HTML', () => {
    const sampleHtml = `
      <html>
        <head>
          <title>Clearwater Cruisin&#39; - YouTube</title>
          <link rel="canonical" href="https://www.youtube.com/channel/UCdOAHfkg7LcKLlzpD8Spydw" />
          <meta property="og:title" content="Clearwater Cruisin&#39;" />
          <meta property="og:description" content="Faith, travel, &amp; fellowship on the open road. New episodes weekly!" />
          <meta property="og:image" content="https://yt3.googleusercontent.com/avatar123=s900" />
        </head>
        <body>
          <script>var ytInitialData = {"header":{"c4TabbedHeaderRenderer":{"banner":{"thumbnails":[{"url":"https://yt3.googleusercontent.com/banner456=w1060"}]}}}};</script>
        </body>
      </html>
    `
    const meta = extractChannelMetaFromHtml(sampleHtml)
    expect(meta.channelId).toBe('UCdOAHfkg7LcKLlzpD8Spydw')
    expect(meta.title).toBe("Clearwater Cruisin'")
    expect(meta.description).toBe('Faith, travel, & fellowship on the open road. New episodes weekly!')
    expect(meta.avatarUrl).toBe('https://yt3.googleusercontent.com/avatar123=s900')
    expect(meta.bannerUrl).toBe('https://yt3.googleusercontent.com/banner456=w1060')
  })

  it('builds crisp taglines from descriptions and handles empty descriptions', () => {
    expect(
      buildTaglineFromDescription(
        'Faith, travel, and fellowship on the open road. New videos every Friday!',
        'Clearwater',
      ),
    ).toBe('Faith, travel, and fellowship on the open road.')

    expect(buildTaglineFromDescription('', 'Nova Studio')).toBe(
      'Nova Studio — Videos, Storefront & Community',
    )
  })
})
