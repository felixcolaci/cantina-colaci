# gen-invite.mjs — List Commands & Subcommand Refactor

**Date:** 2026-07-05
**Status:** Approved

---

## Overview

Extend `scripts/gen-invite.mjs` with `list` commands and refactor the CLI to use explicit subcommands. The existing `create` behaviour is unchanged except the call syntax changes from positional-only to `create <email> [count]`.

---

## CLI Interface

```bash
node scripts/gen-invite.mjs create <email> [count]
node scripts/gen-invite.mjs list
node scripts/gen-invite.mjs list --open
node scripts/gen-invite.mjs list --used
```

Missing or unknown subcommand → stderr usage message, exit 1:
```
Usage:
  node scripts/gen-invite.mjs create <email> [count]
  node scripts/gen-invite.mjs list [--open|--used]
```

---

## `list` Output

Printed to stdout as a fixed-width text table, ordered by `created_at DESC`:

```
CODE              EMAIL                    CREATED       STATUS
WEIN-A3BK-MN2P   hans@beispiel.de         2026-07-05    open
WEIN-DZ84-ZVYW   anna@beispiel.de         2026-07-04    used (2026-07-04)
```

- `STATUS` is `open` when `used_at` is null, otherwise `used (YYYY-MM-DD)`
- Date format: `YYYY-MM-DD` (first 10 chars of ISO string)
- If no rows match the filter → print `No invitation codes found.` (not an error, exit 0)

---

## Supabase REST Queries

Base URL: `GET ${url}/rest/v1/invitation_codes?select=*&order=created_at.desc`

| Command | Additional filter |
|---|---|
| `list` | none |
| `list --open` | `&used_at=is.null` |
| `list --used` | `&used_at=not.is.null` |

Same auth headers as `create` (`apikey`, `Authorization: Bearer`).

---

## File Changes

- Modify: `scripts/gen-invite.mjs` — add subcommand routing, `list` command; refactor arg parsing to read `process.argv[2]` as subcommand

---

## Out of Scope

- `revoke` command
- Pagination (the table will always be small for this use case)
- Color output / fancy formatting
