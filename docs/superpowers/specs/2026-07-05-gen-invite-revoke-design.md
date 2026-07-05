# gen-invite.mjs — Revoke Command

**Date:** 2026-07-05
**Status:** Approved

---

## Overview

Add a `revoke <code>` subcommand to `scripts/gen-invite.mjs` that deletes an invitation code from the database, regardless of whether it has already been used.

---

## CLI Interface

```bash
node scripts/gen-invite.mjs revoke <code>
```

Missing code argument → stderr usage message, exit 1:
```
Usage:
  node scripts/gen-invite.mjs create <email> [count]
  node scripts/gen-invite.mjs list [--open|--used]
  node scripts/gen-invite.mjs revoke <code>
```

---

## Behaviour

- Sends `DELETE /rest/v1/invitation_codes?code=eq.<code>` with `Prefer: return=representation` header
- Response is a JSON array of deleted rows; empty array means no row matched → print `Error: Code not found`, exit 1
- Non-empty array (row was deleted) → print `Revoked <code>`, exit 0
- Non-2xx HTTP response → `Error: Failed to revoke code <code>: <reason>`, exit 1
- No confirmation prompt required (private CLI tool)

---

## File Changes

- Modify: `scripts/gen-invite.mjs`
  - Add `'revoke'` to the allowed-subcommands list in the routing guard
  - Update the `USAGE` constant to include the `revoke` line
  - Add `if (cmd === 'revoke')` block

---

## Out of Scope

- Soft-delete / marking as revoked (hard delete only)
- Confirmation prompts
