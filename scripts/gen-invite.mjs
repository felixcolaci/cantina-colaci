#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [,, email, countArg] = process.argv
const count = parseInt(countArg ?? '1', 10)

if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/gen-invite.mjs <email> [count]')
  process.exit(1)
}

if (isNaN(count) || count < 1) {
  console.error('Error: count must be a positive integer')
  process.exit(1)
}

function parseEnvFile(path) {
  try {
    const vars = {}
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      vars[key] = val
    }
    return vars
  } catch {
    return {}
  }
}

const env = parseEnvFile(resolve(process.cwd(), '.env.local'))
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local')
  process.exit(1)
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomSegment(len) {
  let s = ''
  for (let i = 0; i < len; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)]
  return s
}

function generateCode() {
  return `WEIN-${randomSegment(4)}-${randomSegment(4)}`
}

async function insertCode(code, email) {
  const res = await fetch(`${url}/rest/v1/invitation_codes`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ code, email: email.toLowerCase() }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to insert code ${code}: ${text}`)
  }
}

for (let i = 0; i < count; i++) {
  const code = generateCode()
  await insertCode(code, email)
  console.log(code)
}
