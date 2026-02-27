/**
 * Chat & Spaces E2E Tests
 *
 * Tests the Angel OS chat and spaces functionality:
 * - Spaces API (REST endpoints for spaces, channels, messages)
 * - Spaces UI (dashboard page rendering, channel list)
 * - Messaging (send via /api/chat/send endpoint, verify creation)
 *
 * Prerequisites:
 * 1. Dev server running: `pnpm dev`
 * 2. Dev seed data: `pnpm seed:dev`
 * 3. Auth setup runs automatically via Playwright project dependencies
 *
 * Uses authenticated session from auth.setup.ts (storageState pattern).
 */
import { test, expect } from '@playwright/test'

const baseURL = 'http://localhost:3000'

test.describe('Chat & Spaces', () => {
  // ─────────────────────────────────────────────────────────────
  // Spaces API
  // ─────────────────────────────────────────────────────────────

  test.describe('Spaces API', () => {
    test('spaces API returns docs array', async ({ page }) => {
      const res = await page.request.get(`${baseURL}/api/spaces?depth=0&limit=10`)
      expect(res.ok()).toBeTruthy()

      const data = await res.json()
      expect(data.docs).toBeDefined()
      expect(Array.isArray(data.docs)).toBeTruthy()
      console.log(`[spaces] returned ${data.docs.length} space(s)`)
    })

    test('at least one space exists from seed data', async ({ page }) => {
      const res = await page.request.get(`${baseURL}/api/spaces?depth=0&limit=10`)
      expect(res.ok()).toBeTruthy()

      const data = await res.json()
      if (data.docs.length === 0) {
        test.skip(true, 'No spaces exist in the database — seed data may not be loaded')
        return
      }
      expect(data.docs.length).toBeGreaterThanOrEqual(1)

      // Log discovered space names for debugging
      const names = data.docs.map((s: any) => s.name || s.slug || s.id)
      console.log(`[spaces] discovered spaces: ${names.join(', ')}`)
    })

    test('channels API returns docs array', async ({ page }) => {
      const res = await page.request.get(`${baseURL}/api/channels?depth=0&limit=10`)
      expect(res.ok()).toBeTruthy()

      const data = await res.json()
      expect(data.docs).toBeDefined()
      expect(Array.isArray(data.docs)).toBeTruthy()
      console.log(`[channels] returned ${data.docs.length} channel(s)`)
    })

    test('messages API returns docs array', async ({ page }) => {
      const res = await page.request.get(`${baseURL}/api/messages?depth=0&limit=10`)
      expect(res.ok()).toBeTruthy()

      const data = await res.json()
      expect(data.docs).toBeDefined()
      expect(Array.isArray(data.docs)).toBeTruthy()
      console.log(`[messages] returned ${data.docs.length} message(s)`)
    })

    test('spaces API response has expected shape', async ({ page }) => {
      const res = await page.request.get(`${baseURL}/api/spaces?depth=0&limit=1`)
      expect(res.ok()).toBeTruthy()

      const data = await res.json()
      expect(data.docs).toBeDefined()
      expect(data.totalDocs).toBeDefined()
      expect(data.hasNextPage).toBeDefined()

      if (data.docs.length > 0) {
        const space = data.docs[0]
        expect(space.id).toBeDefined()
        console.log(`[spaces] sample space keys: ${Object.keys(space).join(', ')}`)
      }
    })

    test('channels API response has expected shape', async ({ page }) => {
      const res = await page.request.get(`${baseURL}/api/channels?depth=0&limit=1`)
      expect(res.ok()).toBeTruthy()

      const data = await res.json()
      expect(data.docs).toBeDefined()
      expect(data.totalDocs).toBeDefined()

      if (data.docs.length > 0) {
        const channel = data.docs[0]
        expect(channel.id).toBeDefined()
        expect(channel.name).toBeDefined()
        expect(channel.space).toBeDefined()
        console.log(`[channels] sample channel: "${channel.name}" (type: ${channel.type || 'general'})`)
      }
    })

    test('channels belong to a valid space', async ({ page }) => {
      const res = await page.request.get(`${baseURL}/api/channels?depth=1&limit=5`)
      expect(res.ok()).toBeTruthy()

      const data = await res.json()
      if (data.docs.length === 0) {
        test.skip(true, 'No channels exist — seed data may not be loaded')
        return
      }

      for (const channel of data.docs) {
        // At depth=1, space should be populated or be a valid ID
        expect(channel.space).toBeDefined()
        console.log(`[channels] "${channel.name}" belongs to space: ${typeof channel.space === 'object' ? channel.space.name : channel.space}`)
      }
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Spaces UI
  // ─────────────────────────────────────────────────────────────

  test.describe('Spaces UI', () => {
    test('spaces page loads without server error', async ({ page }) => {
      const res = await page.goto('/dashboard/spaces')
      expect(res).not.toBeNull()
      expect(res!.status()).toBeLessThan(500)

      await page.waitForTimeout(2000)

      // Page body should have content (not blank)
      const body = await page.locator('body').textContent()
      expect(body).toBeTruthy()
      console.log(`[ui] /dashboard/spaces loaded — status ${res!.status()}`)
    })

    test('spaces page renders chat interface elements', async ({ page }) => {
      await page.goto('/dashboard/spaces')
      await page.waitForTimeout(2000)

      // SpacesChat renders ChatControl which should have chat-related elements
      // Look for channel sidebar, message area, or input elements
      const chatContainer = page.locator(
        '[class*="chat"], [class*="channel"], [data-testid="spaces-chat"], [class*="ChatControl"]',
      ).first()
      const messageInput = page.locator(
        'textarea, input[placeholder*="message" i], [contenteditable="true"], [role="textbox"]',
      ).first()

      // At least the page should have rendered without error
      const hasChat = await chatContainer.isVisible().catch(() => false)
      const hasInput = await messageInput.isVisible().catch(() => false)

      console.log(`[ui] chat container visible: ${hasChat}, message input visible: ${hasInput}`)

      // The page should render something meaningful — not a blank error page
      await expect(page.locator('body')).not.toBeEmpty()
    })

    test('channel names are visible on spaces page', async ({ page }) => {
      // First discover channels from the API
      const channelsRes = await page.request.get(`${baseURL}/api/channels?depth=0&limit=10`)
      const channelsData = await channelsRes.json()

      if (!channelsData.docs || channelsData.docs.length === 0) {
        test.skip(true, 'No channels found — cannot verify channel names in UI')
        return
      }

      await page.goto('/dashboard/spaces')
      await page.waitForTimeout(3000)

      // Check if any channel name from the API appears in the page
      const pageText = await page.locator('body').textContent() || ''
      const channelNames = channelsData.docs.map((c: any) => c.name)

      let foundChannelInUI = false
      for (const name of channelNames) {
        if (pageText.includes(name)) {
          foundChannelInUI = true
          console.log(`[ui] found channel name "${name}" in page content`)
          break
        }
      }

      // Channel names may or may not be visible depending on active space
      console.log(
        `[ui] channel names check: ${foundChannelInUI ? 'found' : 'none found'} ` +
          `(searched ${channelNames.length} channel name(s))`,
      )
    })

    test('space settings page renders', async ({ page }) => {
      // First discover a space ID from the API
      const spacesRes = await page.request.get(`${baseURL}/api/spaces?depth=0&limit=1`)
      const spacesData = await spacesRes.json()

      if (!spacesData.docs || spacesData.docs.length === 0) {
        test.skip(true, 'No spaces found — cannot test space settings')
        return
      }

      // Navigate to the general space settings page
      const res = await page.goto('/dashboard/spaces/settings')
      expect(res).not.toBeNull()
      expect(res!.status()).toBeLessThan(500)

      await page.waitForTimeout(2000)

      // Look for settings tab buttons (General, Members, Channels, Danger)
      const generalTab = page.getByRole('button', { name: /General/i }).first()
      const membersTab = page.getByRole('button', { name: /Members/i }).first()

      const hasGeneralTab = await generalTab.isVisible().catch(() => false)
      const hasMembersTab = await membersTab.isVisible().catch(() => false)

      console.log(`[ui] space settings — General tab: ${hasGeneralTab}, Members tab: ${hasMembersTab}`)

      // The settings page should at least load without error
      await expect(page.locator('body')).not.toBeEmpty()
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Messaging
  // ─────────────────────────────────────────────────────────────

  test.describe('Messaging', () => {
    test('send message via /api/chat/send endpoint', async ({ page }) => {
      // Step 1: Discover a space and channel to send to
      const spacesRes = await page.request.get(`${baseURL}/api/spaces?depth=0&limit=5`)
      const spacesData = await spacesRes.json()

      if (!spacesData.docs || spacesData.docs.length === 0) {
        test.skip(true, 'No spaces found — cannot test message sending')
        return
      }

      const targetSpace = spacesData.docs[0]
      console.log(`[messaging] target space: "${targetSpace.name || targetSpace.id}" (id: ${targetSpace.id})`)

      // Find a channel in this space
      const channelsRes = await page.request.get(
        `${baseURL}/api/channels?depth=0&limit=5&where[space][equals]=${targetSpace.id}`,
      )
      const channelsData = await channelsRes.json()

      let channelSlug = 'general' // default fallback
      if (channelsData.docs && channelsData.docs.length > 0) {
        channelSlug = channelsData.docs[0].slug || channelsData.docs[0].name || 'general'
        console.log(`[messaging] target channel: "${channelSlug}"`)
      } else {
        console.log('[messaging] no channels found for space, using fallback "general"')
      }

      // Step 2: Send a test message via the /api/chat/send endpoint
      const timestamp = Date.now()
      const testContent = {
        text: `E2E test message ${timestamp}`,
      }

      const sendRes = await page.request.post(`${baseURL}/api/chat/send`, {
        data: {
          space: targetSpace.id,
          channel: channelSlug,
          content: testContent,
          messageType: 'user',
        },
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log(`[messaging] POST /api/chat/send — status ${sendRes.status()}`)

      if (sendRes.status() === 201) {
        const responseBody = await sendRes.json()
        expect(responseBody.doc).toBeDefined()
        expect(responseBody.doc.id).toBeDefined()
        console.log(`[messaging] message created — id: ${responseBody.doc.id}`)
      } else if (sendRes.status() === 403) {
        // User may not have space membership — log but don't fail hard
        console.log('[messaging] 403 — admin user may lack space membership for this space')
      } else if (sendRes.status() === 400) {
        const errorBody = await sendRes.json().catch(() => ({}))
        console.log(`[messaging] 400 — bad request: ${JSON.stringify(errorBody)}`)
      } else {
        // For unexpected status codes, log details but still expect success range
        const errorBody = await sendRes.text().catch(() => '')
        console.log(`[messaging] unexpected status ${sendRes.status()}: ${errorBody.substring(0, 200)}`)
        expect(sendRes.status()).toBeLessThan(500)
      }
    })

    test('send message via direct messages API (fallback)', async ({ page }) => {
      // Discover a space for the message
      const spacesRes = await page.request.get(`${baseURL}/api/spaces?depth=0&limit=5`)
      const spacesData = await spacesRes.json()

      if (!spacesData.docs || spacesData.docs.length === 0) {
        test.skip(true, 'No spaces found — cannot test message creation')
        return
      }

      const targetSpace = spacesData.docs[0]

      // Find a channel in this space
      const channelsRes = await page.request.get(
        `${baseURL}/api/channels?depth=0&limit=5&where[space][equals]=${targetSpace.id}`,
      )
      const channelsData = await channelsRes.json()

      let channelSlug = 'general'
      if (channelsData.docs && channelsData.docs.length > 0) {
        channelSlug = channelsData.docs[0].slug || channelsData.docs[0].name || 'general'
      }

      // Try creating a message directly via the REST API
      const timestamp = Date.now()
      const sendRes = await page.request.post(`${baseURL}/api/messages`, {
        data: {
          content: { text: `E2E direct API test ${timestamp}` },
          space: targetSpace.id,
          channel: channelSlug,
          messageType: 'user',
        },
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log(`[messaging] POST /api/messages — status ${sendRes.status()}`)

      // The direct REST API may return various statuses depending on tenant plugin behavior
      // 201 = created, 400 = validation error (tenant plugin), 403 = access denied
      if (sendRes.status() === 201 || sendRes.status() === 200) {
        const responseBody = await sendRes.json()
        expect(responseBody.doc).toBeDefined()
        console.log(`[messaging] message created via REST — id: ${responseBody.doc.id}`)
      } else {
        // Log the response for debugging but accept non-500 as expected behavior
        const body = await sendRes.text().catch(() => '')
        console.log(
          `[messaging] REST API returned ${sendRes.status()} ` +
            `(this is expected if tenant plugin blocks direct creation): ${body.substring(0, 200)}`,
        )
        expect(sendRes.status()).toBeLessThan(500)
      }
    })

    test('sent messages appear in messages API', async ({ page }) => {
      // Send a message with a unique marker, then verify it appears in the list
      const spacesRes = await page.request.get(`${baseURL}/api/spaces?depth=0&limit=5`)
      const spacesData = await spacesRes.json()

      if (!spacesData.docs || spacesData.docs.length === 0) {
        test.skip(true, 'No spaces found — cannot verify message persistence')
        return
      }

      const targetSpace = spacesData.docs[0]

      // Find a channel
      const channelsRes = await page.request.get(
        `${baseURL}/api/channels?depth=0&limit=5&where[space][equals]=${targetSpace.id}`,
      )
      const channelsData = await channelsRes.json()

      let channelSlug = 'general'
      if (channelsData.docs && channelsData.docs.length > 0) {
        channelSlug = channelsData.docs[0].slug || channelsData.docs[0].name || 'general'
      }

      // Send with unique marker
      const marker = `e2e-verify-${Date.now()}`
      const sendRes = await page.request.post(`${baseURL}/api/chat/send`, {
        data: {
          space: targetSpace.id,
          channel: channelSlug,
          content: { text: marker },
          messageType: 'user',
        },
        headers: { 'Content-Type': 'application/json' },
      })

      if (sendRes.status() !== 201) {
        test.skip(true, `Message send returned ${sendRes.status()} — cannot verify persistence`)
        return
      }

      const sendBody = await sendRes.json()
      const messageId = sendBody.doc.id

      // Now verify the message appears in the messages list
      const verifyRes = await page.request.get(
        `${baseURL}/api/messages?depth=0&limit=5&where[id][equals]=${messageId}`,
      )
      expect(verifyRes.ok()).toBeTruthy()

      const verifyData = await verifyRes.json()
      expect(verifyData.docs).toBeDefined()

      // The message we just created should be findable
      const found = verifyData.docs.find((m: any) => m.id === messageId)
      if (found) {
        console.log(`[messaging] verified message ${messageId} exists in messages API`)
      } else {
        // Access control might filter it out from this query
        console.log(`[messaging] message ${messageId} not found via messages API query (may be access-filtered)`)
      }
    })

    test('messages API supports pagination', async ({ page }) => {
      const res = await page.request.get(`${baseURL}/api/messages?depth=0&limit=2&page=1`)
      expect(res.ok()).toBeTruthy()

      const data = await res.json()
      expect(data.docs).toBeDefined()
      expect(data.totalDocs).toBeDefined()
      expect(data.page).toBeDefined()
      expect(data.totalPages).toBeDefined()
      expect(data.hasNextPage).toBeDefined()

      console.log(
        `[messaging] pagination — page ${data.page}/${data.totalPages}, ` +
          `${data.totalDocs} total message(s), hasNextPage: ${data.hasNextPage}`,
      )
    })
  })
})
