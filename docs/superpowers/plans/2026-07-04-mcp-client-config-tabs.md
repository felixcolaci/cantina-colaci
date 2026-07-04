# MCP Client Config Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users copy a ready-to-use MCP config for their specific client (Claude Desktop, Claude Code CLI, GitHub Copilot, or generic `mcpServers`-style tools) right after generating an API key, instead of only ever seeing the Claude Desktop `mcp.json` snippet.

**Architecture:** `generate-key-button.tsx` gains a pure helper, `buildMcpConfigs(origin, key)`, that returns all four snippets as strings. The "key just generated" card renders these inside the existing shadcn `Tabs` component (one tab per client), each tab with its own "Copy" button. No other files, routes, or backend behavior change.

**Tech Stack:** Next.js 16 (client component), React, shadcn `Tabs` (`@base-ui/react/tabs` under the hood, already in the project), Vitest + React Testing Library for tests.

## Global Constraints

- Only `app/(app)/settings/api-keys/generate-key-button.tsx` is modified; no changes to `page.tsx`, `revoke-key-form.tsx`, or `lib/actions/api-keys.ts` (per spec: existing keys never show a config again, so nothing there needs to change).
- The MCP endpoint is `${origin}/api/mcp` using Streamable HTTP transport (see `app/api/mcp/route.ts`) — every config format must point at that URL with `Authorization: Bearer <key>`.
- GitHub Copilot (VS Code) config must use the top-level key `servers` (not `mcpServers`) and include `"type": "http"`.
- Default active tab is Claude Desktop (matches current/least-surprising behavior).
- Follow the existing test convention: Vitest + `@testing-library/react`, `vi.mock` for module mocks (see `lib/__tests__/bottom-nav.test.tsx`, `lib/__tests__/submit-button.test.tsx`).

---

### Task 1: `buildMcpConfigs` helper — the four config strings

**Files:**
- Modify: `app/(app)/settings/api-keys/generate-key-button.tsx` (add and export the helper, above the `GenerateKeyButton` component)
- Test: `lib/__tests__/generate-key-button.test.tsx` (new file)

**Interfaces:**
- Produces: `export function buildMcpConfigs(origin: string, key: string): { claudeDesktop: string; claudeCli: string; copilot: string; generic: string }` — a pure function, no React/DOM dependency. Task 2 imports this from the same file and uses the returned object's four keys to render tabs.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/generate-key-button.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { buildMcpConfigs } from '@/app/(app)/settings/api-keys/generate-key-button'

describe('buildMcpConfigs', () => {
  const origin = 'https://cantina.example.com'
  const key = 'test-key-123'

  it('builds the Claude Desktop config with mcpServers and a Bearer header', () => {
    const { claudeDesktop } = buildMcpConfigs(origin, key)
    expect(JSON.parse(claudeDesktop)).toEqual({
      mcpServers: {
        'cantina-colaci': {
          url: 'https://cantina.example.com/api/mcp',
          headers: { Authorization: 'Bearer test-key-123' },
        },
      },
    })
  })

  it('builds the Claude Code CLI command', () => {
    const { claudeCli } = buildMcpConfigs(origin, key)
    expect(claudeCli).toBe(
      'claude mcp add --transport http cantina-colaci https://cantina.example.com/api/mcp --header "Authorization: Bearer test-key-123"'
    )
  })

  it('builds the GitHub Copilot config with servers and type "http"', () => {
    const { copilot } = buildMcpConfigs(origin, key)
    expect(JSON.parse(copilot)).toEqual({
      servers: {
        'cantina-colaci': {
          type: 'http',
          url: 'https://cantina.example.com/api/mcp',
          headers: { Authorization: 'Bearer test-key-123' },
        },
      },
    })
  })

  it('builds the generic config identical to the Claude Desktop config', () => {
    const configs = buildMcpConfigs(origin, key)
    expect(configs.generic).toBe(configs.claudeDesktop)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/__tests__/generate-key-button.test.tsx`
Expected: FAIL — `buildMcpConfigs` is not exported from `generate-key-button.tsx` (module has no such export yet).

- [ ] **Step 3: Add the helper**

At the top of `app/(app)/settings/api-keys/generate-key-button.tsx`, after the existing imports, add:

```tsx
export function buildMcpConfigs(origin: string, key: string) {
  const url = `${origin}/api/mcp`

  const claudeDesktop = JSON.stringify({
    mcpServers: {
      'cantina-colaci': {
        url,
        headers: { Authorization: `Bearer ${key}` },
      },
    },
  }, null, 2)

  const claudeCli = `claude mcp add --transport http cantina-colaci ${url} --header "Authorization: Bearer ${key}"`

  const copilot = JSON.stringify({
    servers: {
      'cantina-colaci': {
        type: 'http',
        url,
        headers: { Authorization: `Bearer ${key}` },
      },
    },
  }, null, 2)

  const generic = claudeDesktop

  return { claudeDesktop, claudeCli, copilot, generic }
}
```

Do not remove the existing `config` variable inside `GenerateKeyButton` yet — that happens in Task 2.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/__tests__/generate-key-button.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/settings/api-keys/generate-key-button.tsx lib/__tests__/generate-key-button.test.tsx
git commit -m "feat: add buildMcpConfigs helper for multi-client MCP configs"
```

---

### Task 2: Tabbed client picker in the generated-key card

**Files:**
- Modify: `app/(app)/settings/api-keys/generate-key-button.tsx` (replace the single JSON `<pre>` block with `Tabs`)
- Test: `lib/__tests__/generate-key-button.test.tsx` (extend, same file as Task 1)

**Interfaces:**
- Consumes: `buildMcpConfigs(origin, key)` from Task 1 — returns `{ claudeDesktop, claudeCli, copilot, generic }`.
- Consumes: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs` — `Tabs` takes `defaultValue` (string), `TabsTrigger`/`TabsContent` each take a matching `value` (string) prop; a `TabsContent` is only mounted in the DOM while its matching tab is active (`keepMounted` defaults to `false`).

- [ ] **Step 1: Write the failing tests**

Append to `lib/__tests__/generate-key-button.test.tsx` (add these imports at the top alongside the existing ones, and a new `describe` block at the bottom):

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { GenerateKeyButton } from '@/app/(app)/settings/api-keys/generate-key-button'

vi.mock('@/lib/actions/api-keys', () => ({
  generateApiKey: vi.fn().mockResolvedValue({ key: 'generated-key-456' }),
}))
```

```tsx
describe('GenerateKeyButton', () => {
  async function generateKey() {
    render(<GenerateKeyButton />)
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Claude Desktop' } })
    fireEvent.click(screen.getByRole('button', { name: /API-Schlüssel generieren/ }))
    await waitFor(() => screen.getByText('generated-key-456'))
  }

  it('defaults to the Claude Desktop tab showing mcpServers JSON', async () => {
    await generateKey()
    expect(screen.getByText(/"mcpServers"/)).toBeInTheDocument()
  })

  it('shows the Claude Code CLI command on that tab', async () => {
    await generateKey()
    fireEvent.click(screen.getByRole('tab', { name: 'Claude Code CLI' }))
    expect(screen.getByText(/claude mcp add --transport http/)).toBeInTheDocument()
  })

  it('shows the GitHub Copilot config with a servers key on that tab', async () => {
    await generateKey()
    fireEvent.click(screen.getByRole('tab', { name: 'GitHub Copilot' }))
    expect(screen.getByText(/"servers"/)).toBeInTheDocument()
  })

  it('copies the active tab\'s config to the clipboard', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } })
    await generateKey()
    fireEvent.click(screen.getByRole('tab', { name: 'Claude Code CLI' }))
    fireEvent.click(screen.getByRole('button', { name: 'Config kopieren' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('claude mcp add --transport http')
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/__tests__/generate-key-button.test.tsx`
Expected: FAIL — the four new `GenerateKeyButton` tests fail because the component still renders a single static JSON block with no tabs (no element with role `tab`, no CLI command text, no per-tab copy button).

- [ ] **Step 3: Replace the static config block with Tabs**

In `app/(app)/settings/api-keys/generate-key-button.tsx`:

Add to the imports:

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
```

Add this constant above `GenerateKeyButton` (after `buildMcpConfigs`):

```tsx
const CLIENT_TABS = [
  { value: 'claudeDesktop', label: 'Claude Desktop' },
  { value: 'claudeCli', label: 'Claude Code CLI' },
  { value: 'copilot', label: 'GitHub Copilot' },
  { value: 'generic', label: 'Generisch' },
] as const
```

Inside `GenerateKeyButton`, replace:

```tsx
  if (generated) {
    const config = JSON.stringify({
      mcpServers: {
        'cantina-colaci': {
          url: `${window.location.origin}/api/mcp`,
          headers: { Authorization: `Bearer ${generated}` },
        },
      },
    }, null, 2)

    return (
```

with:

```tsx
  if (generated) {
    const configs = buildMcpConfigs(window.location.origin, generated)

    return (
```

Then replace the second `<div>` inside `CardContent` (the one currently rendering the single `config` `<pre>` and the one "Config kopieren" button below it) with:

```tsx
          <div>
            <p className="text-sm font-medium text-green-800 mb-1">
              Config für deinen MCP-Client:
            </p>
            <Tabs defaultValue="claudeDesktop">
              <TabsList>
                {CLIENT_TABS.map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {CLIENT_TABS.map(tab => (
                <TabsContent key={tab.value} value={tab.value} className="space-y-2 pt-2">
                  <pre className="p-3 bg-white rounded border text-xs overflow-x-auto select-all">
                    {configs[tab.value]}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(configs[tab.value])}
                  >
                    Config kopieren
                  </Button>
                </TabsContent>
              ))}
            </Tabs>
          </div>
```

Remove the now-unused standalone `Button` that previously sat below both blocks and copied `config` (it's superseded by the per-tab copy buttons above).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/__tests__/generate-key-button.test.tsx`
Expected: PASS (8 tests total: 4 from Task 1, 4 from Task 2)

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: PASS (all existing tests plus the new ones)

- [ ] **Step 6: Manual browser check**

Run: `npm run dev`, log in, go to `/settings/api-keys`, generate a key, and confirm:
- Claude Desktop tab is active by default and shows the `mcpServers` JSON.
- Claude Code CLI tab shows the `claude mcp add ...` command.
- GitHub Copilot tab shows `servers` + `"type": "http"`.
- Generisch tab shows the same JSON as Claude Desktop.
- Each tab's "Config kopieren" button copies that tab's content (paste somewhere to confirm).

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/settings/api-keys/generate-key-button.tsx lib/__tests__/generate-key-button.test.tsx
git commit -m "feat: add multi-client tabs (Claude CLI, Copilot, generic) to API key config"
```
