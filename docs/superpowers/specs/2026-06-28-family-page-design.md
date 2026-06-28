# Family-Seite — Editorial Styling + Mitgliedernamen — Spec

**Datum:** 2026-06-28  
**Status:** Approved

## Ziel

Die Family-Seite erhält ein editorial gestyltes Layout (kein shadcn Card) und zeigt lesbare Mitgliedernamen statt gekürzter UUIDs. Mitglieder können ihren Anzeigenamen setzen — beim ersten Besuch per Inline-Prompt, danach per Stift-Icon.

---

## Datenmodell

### DB-Migration

```sql
ALTER TABLE family_members ADD COLUMN display_name TEXT;
```

### Name-Auflösung (Priorität)

1. `family_members.display_name` — wenn gesetzt
2. E-Mail-Präfix aus `auth.users` — `felix@colaci.eu` → "Felix" (erster Buchstabe groß)

E-Mails werden serverseitig via `admin.auth.admin.listUsers()` geladen und per `user_id` gematcht.

### TypeScript-Typ (lokal in `page.tsx`)

```ts
type MemberWithName = {
  user_id: string
  role: FamilyRole
  joined_at: string
  display_name: string | null
  email: string        // aus auth.users, immer vorhanden
  resolvedName: string // display_name ?? capitalize(emailPrefix)
  initials: string     // erste 2 Buchstaben von resolvedName
}
```

---

## Server Action: `setDisplayName`

**Datei:** `lib/actions/family.ts` (neu)

```ts
'use server'
// Autorisierungscheck: nur eigener user_id darf geschrieben werden
// update family_members.display_name where user_id = user.id and family_id = membership.family_id
// revalidatePath('/family')
```

**Felder im FormData:** `display_name: string` (max. 40 Zeichen, trim, leer = null)

---

## Interaktion

### Erster Besuch (display_name === null)

Über der Mitgliederliste erscheint ein Inline-Prompt:

```
┌─────────────────────────────────────┐
│  Wie möchtest du heißen?            │
│  ┌─────────────────────┐ [Speichern]│
│  │ Felix               │            │  ← vorausgefüllt mit emailPrefix
│  └─────────────────────┘            │
└─────────────────────────────────────┘
```

Client-Komponente `SetNamePrompt` — `useServerAction(setDisplayName)`, nach Erfolg `router.refresh()`.

### Namen bearbeiten (display_name gesetzt)

Nur die eigene Zeile zeigt ein Stift-Icon (Pencil, lucide-react). Klick öffnet `EditNameSheet` (Sheet von unten), vorausgefüllt mit aktuellem Namen. Dieselbe Action `setDisplayName`.

---

## Layout

### Seitenstruktur

```
FAMILIE                        ← .eyebrow
Cantina Colaci                 ← display-hero h1
━━━━━━━━━━━━━━━━━━━            ← <hr className="rule-gold">

[FC] Felix           OWNER     ← MemberRow
[SA] Sarah        ✏            ← MemberRow (✏ nur bei eigener Zeile)

──────────────────────         ← <hr> mit var(--border)

Mitglied einladen              ← section heading
Link teilen…                   ← muted-foreground text
[Einladungslink kopieren]      ← CopyInviteLink

(Demo-Abschnitt, wenn is_demo)
```

### Avatar

- 36 × 36 px, `border-radius: 50%`
- `background: var(--primary)`, `color: var(--primary-foreground)`
- `font-family: var(--font-display)`, `font-size: var(--text-sm)`, `font-weight: 600`
- Inhalt: Initialen aus `resolvedName` — bei einem Wort erste 2 Buchstaben ("FE"), bei mehreren Wörtern je erster Buchstabe ("FC" für "Felix Colaci"), immer groß
- Wenn `resolvedName` nur 1 Zeichen: Buchstabe doppelt

### Owner-Badge (nur wenn `role === 'owner'`)

```tsx
<span style={{
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-xs)',
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--primary)',
}}>
  Owner
</span>
```

Kein shadcn `<Badge>`.

### Sektionen

Kein shadcn `<Card>`. Trennlinie mit `<hr className="rule-gold">` (CSS-Utility aus globals.css). Normale `<hr>` mit `border-color: var(--border)` zwischen Mitgliederliste und Einladen-Sektion.

---

## Neue Dateien

| Datei | Typ | Inhalt |
|-------|-----|--------|
| `lib/actions/family.ts` | Server | `setDisplayName` action |
| `app/family/set-name-prompt.tsx` | Client | Inline-Prompt für ersten Besuch |
| `app/family/edit-name-sheet.tsx` | Client | Sheet für Namensbearbeitung |

## Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `app/family/page.tsx` | Kompletter Umbau: editorial Layout, Admin-SDK für Emails, MemberRow-Rendering |

## Gelöschte Importe / Komponenten

`Card`, `CardContent`, `CardHeader`, `CardTitle`, `Badge` aus `page.tsx` entfernen — nicht mehr verwendet.

---

## Was sich nicht ändert

- `app/family/copy-invite-link.tsx` — unverändert
- `app/family/start-own-cellar.tsx` — unverändert
- Einladen-Link-Logik — unverändert
- Demo-Abschnitt-Logik — unverändert (nur Styling wird angepasst)
