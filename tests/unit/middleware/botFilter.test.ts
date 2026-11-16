import { describe, it, expect, beforeEach } from 'vitest'
import {
  _resetCrawlStore,
  checkAnonymousCrawlLimit,
  isBlockedBotUserAgent,
  isBlockedScannerPath,
} from '@/middleware/botFilter'

describe('isBlockedScannerPath', () => {
  it.each([
    '/wp-admin',
    '/wp-admin/install.php',
    '/wp-login.php',
    '/en/wp-login.php',
    '/wp-content/uploads/shell.php',
    '/xmlrpc.php',
    '/.env',
    '/.env.production',
    '/.git/config',
    '/phpmyadmin/index.php',
    '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php',
    '/cgi-bin/test.cgi',
    '/actuator/env',
    '/shell.php',
    '/index.aspx',
    '/backup.sql',
  ])('blocks scanner probe path %s', (path) => {
    expect(isBlockedScannerPath(path)).toBe(true)
  })

  it.each([
    '/',
    '/about',
    '/en/shop',
    '/products/solar-panel',
    '/dashboard/admin/site-log',
    '/api/health',
    '/api/stripe/webhooks',
    '/admin/collections/pages',
  ])('allows legitimate app path %s', (path) => {
    expect(isBlockedScannerPath(path)).toBe(false)
  })
})

describe('isBlockedBotUserAgent', () => {
  it.each([
    'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)',
    'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
    'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Bytespider',
    'CCBot/2.0 (https://commoncrawl.org/faq/)',
    'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
    'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
    'Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)',
    'Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot)',
    'Mozilla/5.0 (compatible; BLEXBot/1.0; +http://webmeup-crawler.com/)',
    'Mozilla/5.0 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)',
    'python-requests/2.31.0',
    'Go-http-client/1.1',
    'sqlmap/1.7.2#stable',
    'Mozilla/5.0 (compatible; Nuclei - Open-source project)',
  ])('blocks scraper/scanner UA: %s', (ua) => {
    expect(isBlockedBotUserAgent(ua)).toBe(true)
  })

  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Twitterbot/1.0',
    'LinkedInBot/1.0',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    'Stripe/1.0 (+https://stripe.com/docs/webhooks)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  ])('allows legitimate browser, search engine, or webhook UA: %s', (ua) => {
    expect(isBlockedBotUserAgent(ua)).toBe(false)
  })
})

describe('checkAnonymousCrawlLimit', () => {
  beforeEach(() => {
    _resetCrawlStore()
  })

  it('allows normal browsing up to 90 requests per minute and throttles request 91', () => {
    const ip = '203.0.113.42'
    const now = 1_700_000_000_000
    for (let i = 1; i <= 90; i++) {
      expect(checkAnonymousCrawlLimit(ip, now + i * 10).allowed).toBe(true)
    }
    const throttled = checkAnonymousCrawlLimit(ip, now + 1000)
    expect(throttled.allowed).toBe(false)
    expect(throttled.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('resets after the 60s window expires', () => {
    const ip = '203.0.113.99'
    const now = 1_700_000_000_000
    for (let i = 1; i <= 91; i++) {
      checkAnonymousCrawlLimit(ip, now)
    }
    expect(checkAnonymousCrawlLimit(ip, now).allowed).toBe(false)
    expect(checkAnonymousCrawlLimit(ip, now + 60_001).allowed).toBe(true)
  })
})
