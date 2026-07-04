# MCP Client Config Tabs — Design Spec

**Date:** 2026-07-04
**Repository:** git@github.com:felixcolaci/cantina-colaci.git
**Status:** Approved
**Depends on:** `2026-06-21-mcp-server-design.md`

---

## Overview

Right after generating an API key, `/settings/api-keys` shows a single ready-to-paste `mcp.json` snippet for Claude Desktop. Users of other MCP clients (Claude Code CLI, GitHub Copilot in VS Code, and other tools that follow the generic `mcpServers` convention) have to manually adapt the format themselves.

This is a small, self-contained addition to `generate-key-button.tsx`: replace the single code block with a tabbed picker offering four ready-to-copy formats for the same generated key.

## Scope

Only the "key just generated" card in `generate-key-button.tsx` changes. Existing keys on `/settings/api-keys/page.tsx` are unaffected — the raw key is never shown again after generation, so there's nothing to reformat there.

## UI

Use the existing `components/ui/tabs.tsx` (shadcn Tabs, already a project dependency — no new packages).

Four tabs, each with its own snippet and its own "Copy" button (copies only the active tab's content):

1. **Claude Desktop** — JSON, `mcpServers` key (current format, unchanged):
   ```json
   {
     "mcpServers": {
       "cantina-colaci": {
         "url": "<origin>/api/mcp",
         "headers": { "Authorization": "Bearer <key>" }
       }
     }
   }
   ```

2. **Claude Code CLI** — a single shell command instead of JSON:
   ```
   claude mcp add --transport http cantina-colaci <origin>/api/mcp --header "Authorization: Bearer <key>"
   ```

3. **GitHub Copilot (VS Code)** — JSON, VS Code MCP convention: top-level `servers` key (not `mcpServers`) and explicit `"type": "http"` (VS Code requires this; Claude Desktop infers transport from the shape of the entry):
   ```json
   {
     "servers": {
       "cantina-colaci": {
         "type": "http",
         "url": "<origin>/api/mcp",
         "headers": { "Authorization": "Bearer <key>" }
       }
     }
   }
   ```

4. **Generic (Cursor, Windsurf, Cline, …)** — same shape as Claude Desktop's `mcpServers` JSON, shown under its own label so users of other `mcpServers`-convention clients don't have to guess whether the Claude Desktop tab applies to them too.

Default active tab: Claude Desktop (current behavior, least surprising).

## Implementation notes

- All four snippets are derived from the same two dynamic values already in scope: `window.location.origin` and `generated` (the key). No new state beyond which tab is active (handled internally by the Tabs component).
- Each tab's code block keeps the existing `<pre>` + `select-all` styling; only the content and the per-tab Copy button are new.
- No backend, schema, or API changes — this is presentational only.

## Testing

The project has an established convention of testing interactive UI components with Vitest + React Testing Library (see `lib/__tests__/submit-button.test.tsx`, `combobox.test.tsx`, etc.). This component follows that convention:

- `lib/__tests__/generate-key-button.test.tsx` (new): renders the generated-key card and asserts, per tab, that the visible snippet contains the expected format (`mcpServers` vs `servers` vs the `claude mcp add` command) and that clicking that tab's Copy button calls `navigator.clipboard.writeText` with the exact expected string. `navigator.clipboard.writeText` is mocked with `vi.fn()` since jsdom doesn't implement the Clipboard API.
- Manual check in the browser as a final sanity pass: generate a key, switch through all four tabs, confirm content and copy behavior.
