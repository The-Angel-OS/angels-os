import fetch from 'node-fetch'

const CRON_SECRET = '47ff6a5a8b02f942d2359cd3fccdb8798b37208e01a5633ee88e916c6cbe26ae'
const BASE_URL = 'https://www.spacesangels.com'

async function main() {
  console.log('[Trigger] Calling UAP provisioning endpoint...')
  const url = `${BASE_URL}/api/provision-ops/uap-portal?key=${CRON_SECRET}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Antigravity-Admin/1.0',
      },
    })

    const status = res.status
    const text = await res.text()
    console.log(`[Trigger] HTTP Status: ${status}`)
    try {
      const json = JSON.parse(text)
      console.log('[Trigger] JSON Response:', JSON.stringify(json, null, 2))
    } catch {
      console.log('[Trigger] Raw Response:', text.slice(0, 500))
    }
  } catch (err) {
    console.error('[Trigger] Request error:', err)
  }
}

main()
