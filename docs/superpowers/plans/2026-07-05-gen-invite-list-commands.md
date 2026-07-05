# gen-invite.mjs List Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `scripts/gen-invite.mjs` to use explicit subcommands and add `list`, `list --open`, and `list --used` commands.

**Architecture:** Single-file rewrite. `process.argv[2]` becomes the subcommand (`create` | `list`). The existing create logic moves into an `if (cmd === 'create')` block. A new `if (cmd === 'list')` block fetches rows via Supabase REST API and prints a dynamic-width text table.

**Tech Stack:** Node.js ESM, Supabase REST API (fetch), `node:crypto` (randomInt), `node:fs`

## Global Constraints

- Code format: `WEIN-XXXX-YYYY`, charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- CSPRNG: `randomInt` from `node:crypto` — no `Math.random()`
- Reads `.env.local` manually — no dotenv dependency
- Emails stored lowercase in DB
- Script exits with code 1 on error, prints error to stderr with `Error:` prefix
- Missing subcommand or unknown subcommand → print usage to stderr, exit 1
- `list` output: fixed-width text table with dynamic column widths, ordered by `created_at DESC`
- Empty result: print `No invitation codes found.`, exit 0
- `STATUS` value: `open` (when `used_at` is null) or `used (YYYY-MM-DD)` (first 10 chars of `used_at`)
- Date format: `YYYY-MM-DD` (first 10 chars of ISO string)
- REST filter for `--open`: `&used_at=is.null`
- REST filter for `--used`: `&used_at=not.is.null`

---

### Task 1: Refactor gen-invite.mjs — subcommands + list command

**Files:**
- Modify: `scripts/gen-invite.mjs`

**Interfaces:**
- Consumes: `.env.local` (parsed manually), Supabase REST API (`invitation_codes` table: `code`, `email`, `created_at`, `used_at`)
- Produces: CLI with `create <email> [count]` and `list [--open|--used]` subcommands

- [ ] **Step 1: Replace `scripts/gen-invite.mjs` with the new implementation**

```js
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
```

- [ ] **Step 2: Test — no subcommand**

```bash
node scripts/gen-invite.mjs
```

Expected stderr:
```
Usage:
  node scripts/gen-invite.mjs create <email> [count]
  node scripts/gen-invite.mjs list [--open|--used]
```
Expected exit code: 1

- [ ] **Step 3: Test — unknown subcommand**

```bash
node scripts/gen-invite.mjs delete
```

Expected: same usage message on stderr, exit 1.

- [ ] **Step 4: Test — create without email**

```bash
node scripts/gen-invite.mjs create
```

Expected: usage message on stderr, exit 1.

- [ ] **Step 5: Test — list all codes**

```bash
node scripts/gen-invite.mjs list
```

Expected: table with header row `CODE   EMAIL   CREATED   STATUS` followed by rows, or `No invitation codes found.` if empty. Exit 0.

- [ ] **Step 6: Test — list open codes**

```bash
node scripts/gen-invite.mjs list --open
```

Expected: only rows where `STATUS` is `open`. Exit 0.

- [ ] **Step 7: Test — list used codes**

```bash
node scripts/gen-invite.mjs list --used
```

Expected: only rows where `STATUS` starts with `used (`. Exit 0.

- [ ] **Step 8: Test — create still works**

```bash
node scripts/gen-invite.mjs create test-list@cantina-colaci.test
```

Expected: one `WEIN-XXXX-YYYY` code printed. Verify it now appears in `list --open` output.

- [ ] **Step 9: Test — invalid list flag**

```bash
node scripts/gen-invite.mjs list --all
```

Expected: usage message on stderr, exit 1.

- [ ] **Step 10: Commit**

```bash
git add scripts/gen-invite.mjs
git commit -m "feat: add list subcommand and refactor gen-invite.mjs to use subcommands"
```
