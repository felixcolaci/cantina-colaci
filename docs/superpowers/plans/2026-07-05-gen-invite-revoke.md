# gen-invite.mjs Revoke Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `revoke <code>` subcommand to `scripts/gen-invite.mjs` that hard-deletes an invitation code from the database.

**Architecture:** Three targeted edits to `scripts/gen-invite.mjs`: update the `USAGE` constant, add `'revoke'` to the routing guard's allowed-commands array, and append an `if (cmd === 'revoke')` block that sends a `DELETE` to the Supabase REST API with `Prefer: return=representation` to detect missing codes.

**Tech Stack:** Node.js ESM, Supabase REST API (fetch)

## Global Constraints

- Script exits with code 1 on error, `Error:` prefix to stderr
- Missing code argument → print updated USAGE to stderr, exit 1
- Code not found (empty array returned) → `Error: Code not found`, exit 1
- HTTP error → `Error: Failed to revoke code <code>: <reason>`, exit 1
- Success → `Revoked <code>`, exit 0
- REST call: `DELETE /rest/v1/invitation_codes?code=eq.<code>` with `Prefer: return=representation`
- No confirmation prompt
- Updated USAGE must include all three subcommands:
  ```
  Usage:
    node scripts/gen-invite.mjs create <email> [count]
    node scripts/gen-invite.mjs list [--open|--used]
    node scripts/gen-invite.mjs revoke <code>
  ```

---

### Task 1: Add revoke subcommand

**Files:**
- Modify: `scripts/gen-invite.mjs`

**Interfaces:**
- Consumes: existing `url`, `key`, `USAGE` constants and subcommand routing pattern already in the file
- Produces: `node scripts/gen-invite.mjs revoke <code>` CLI behaviour

- [ ] **Step 1: Update the `USAGE` constant**

Find this block near the top of `scripts/gen-invite.mjs`:
```js
const USAGE = `Usage:
  node scripts/gen-invite.mjs create <email> [count]
  node scripts/gen-invite.mjs list [--open|--used]`
```

Replace with:
```js
const USAGE = `Usage:
  node scripts/gen-invite.mjs create <email> [count]
  node scripts/gen-invite.mjs list [--open|--used]
  node scripts/gen-invite.mjs revoke <code>`
```

- [ ] **Step 2: Add `'revoke'` to the routing guard**

Find:
```js
if (!cmd || !['create', 'list'].includes(cmd)) {
```

Replace with:
```js
if (!cmd || !['create', 'list', 'revoke'].includes(cmd)) {
```

- [ ] **Step 3: Append the revoke block at the end of the file**

Add after the closing `}` of the `if (cmd === 'list')` block:

```js
if (cmd === 'revoke') {
  const [code] = args
  if (!code) {
    console.error(USAGE)
    process.exit(1)
  }
  try {
    const res = await fetch(
      `${url}/rest/v1/invitation_codes?code=eq.${encodeURIComponent(code)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Prefer: 'return=representation',
        },
      },
    )
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed to revoke code ${code}: ${text}`)
    }
    const deleted = await res.json()
    if (deleted.length === 0) {
      console.error('Error: Code not found')
      process.exit(1)
    }
    console.log(`Revoked ${code}`)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}
```

- [ ] **Step 4: Test — no subcommand still shows updated usage**

```bash
node scripts/gen-invite.mjs
```

Expected stderr (includes the revoke line now):
```
Usage:
  node scripts/gen-invite.mjs create <email> [count]
  node scripts/gen-invite.mjs list [--open|--used]
  node scripts/gen-invite.mjs revoke <code>
```
Expected exit code: 1

- [ ] **Step 5: Test — revoke without code argument**

```bash
node scripts/gen-invite.mjs revoke
```

Expected stderr: same usage message as Step 4. Exit code: 1.

- [ ] **Step 6: Test — revoke with a non-existent code (live DB)**

```bash
node scripts/gen-invite.mjs revoke WEIN-0000-0000
```

Expected stderr:
```
Error: Code not found
```
Expected exit code: 1

- [ ] **Step 7: Test — revoke a real open code (live DB)**

First create a test code:
```bash
node scripts/gen-invite.mjs create test-revoke@cantina-colaci.test
```
Note the printed code (e.g. `WEIN-AB3K-MN2P`), then:
```bash
node scripts/gen-invite.mjs revoke WEIN-AB3K-MN2P
```

Expected stdout:
```
Revoked WEIN-AB3K-MN2P
```
Expected exit code: 0. Verify in Supabase Dashboard that the row is gone.

- [ ] **Step 8: Commit**

```bash
git add scripts/gen-invite.mjs
git commit -m "feat: add revoke subcommand to gen-invite.mjs"
```
