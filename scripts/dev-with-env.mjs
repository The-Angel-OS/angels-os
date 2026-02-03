#!/usr/bin/env node
/**
 * Dev server launcher that loads .env.local before starting Next.js.
 * Node's native --env-file can fail on .env.local with comments/special chars.
 */
import { config } from 'dotenv'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const envLocalPath = path.join(root, '.env.local')
const envPath = path.join(root, '.env')
config({ path: envLocalPath })
config({ path: envPath })

if (!process.env.PAYLOAD_SECRET) {
  console.error(`
ERROR: PAYLOAD_SECRET not found. Ensure one of these has PAYLOAD_SECRET=your-secret:
  - .env.local (save the file in your editor if you have it open)
  - .env

Create .env with at least:
  PAYLOAD_SECRET=your-64-char-hex-secret
  DATABASE_URI=postgresql://user:pass@host:5432/dbname
`)
  process.exit(1)
}

const child = spawn('node', [
  '--no-deprecation',
  './node_modules/next/dist/bin/next',
  'dev',
], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || '--no-deprecation' },
})
child.on('exit', (code) => process.exit(code ?? 0))
