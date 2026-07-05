#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomInt } from 'node:crypto'

const [,, cmd, ...args] = process.argv

const USAGE = `Usage:
  node scripts/gen-invite.mjs create <email> [count]
  node scripts/gen-invite.mjs list [--open|--used]`

if (!cmd || !['create', 'list'].includes(cmd)) {
  console.error(USAGE)
  process.exit(1)
}

function parseEnvFile(path) {
  const vars = {}
  const content = readFileSync(path, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    vars[key] = val
  }
  return vars
}

let env
try {
  env = parseEnvFile(resolve(process.cwd(), '.env.local'))
} catch {
  console.error('Error: .env.local not found. Create it with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local')
  process.exit(1)
}

if (cmd === 'create') {
  const [email, countArg] = args
  const count = parseInt(countArg ?? '1', 10)

  if (!email || !email.includes('@')) {
    console.error(USAGE)
    process.exit(1)
  }

  if (isNaN(count) || count < 1) {
    console.error('Error: count must be a positive integer')
    process.exit(1)
  }

  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

  function randomSegment(len) {
    let s = ''
    for (let i = 0; i < len; i++) s += CHARS[randomInt(CHARS.length)]
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

  try {
    for (let i = 0; i < count; i++) {
      const code = generateCode()
      await insertCode(code, email)
      console.log(code)
    }
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

if (cmd === 'list') {
  const flag = args[0]

  if (flag && flag !== '--open' && flag !== '--used') {
    console.error(USAGE)
    process.exit(1)
  }

  let endpoint = `${url}/rest/v1/invitation_codes?select=*&order=created_at.desc`
  if (flag === '--open') endpoint += '&used_at=is.null'
  if (flag === '--used') endpoint += '&used_at=not.is.null'

  try {
    const res = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed to fetch invitation codes: ${text}`)
    }
    const rows = await res.json()

    if (rows.length === 0) {
      console.log('No invitation codes found.')
      process.exit(0)
    }

    const data = rows.map(r => ({
      code: r.code,
      email: r.email,
      created: r.created_at.slice(0, 10),
      status: r.used_at ? `used (${r.used_at.slice(0, 10)})` : 'open',
    }))

    const H = { code: 'CODE', email: 'EMAIL', created: 'CREATED', status: 'STATUS' }
    const w = {
      code: Math.max(H.code.length, ...data.map(r => r.code.length)),
      email: Math.max(H.email.length, ...data.map(r => r.email.length)),
      created: Math.max(H.created.length, ...data.map(r => r.created.length)),
      status: Math.max(H.status.length, ...data.map(r => r.status.length)),
    }

    const fmt = r =>
      `${r.code.padEnd(w.code)}   ${r.email.padEnd(w.email)}   ${r.created.padEnd(w.created)}   ${r.status}`

    console.log(fmt(H))
    for (const r of data) console.log(fmt(r))
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}
