// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'

// Ensure PAYLOAD_SECRET is set for tests (startup guard requires 32+ chars)
if (!process.env.PAYLOAD_SECRET || process.env.PAYLOAD_SECRET.length < 32) {
  process.env.PAYLOAD_SECRET = 'test-payload-secret-at-least-32-characters-long'
}
