# Dashboard Redesign — Spec

**Datum:** 2026-06-28  
**Status:** Approved

## Ziel

Die Startseite (`/`) wird vom generischen Stats-Screen zum stimmungssetzenden Einstieg der App. Der zuletzt hinzugefügte Wein steht visuell im Zentrum — als kuratierter "Wein des Moments". Darunter kompakte Statistiken und die letzten Verkostungen.

## Layout & Struktur

Vertikale Abfolge, `max-w-lg mx-auto px-4 py-6`:

1. **Kein Seitenheading** — der Hero ist selbsterklärend, kein generischer Titel
2. **Wine-Hero-Card** — zuletzt hinzugefügter Wein als Gradient-Card
3. **Stats-Grid** — 2 Karten nebeneinander: Flaschen im Keller / Verschiedene Weine
4. **Letzte Verkostungen** — eyebrow "Letzte Verkostungen" + max. 3 TastingCard-Einträge
5. **Leerer Zustand** (kein Wein im Keller) — Bottle-Glyph + CTA "Ersten Wein hinzufügen"

## Komponenten

### `components/dashboard/wine-hero-card.tsx` (neu)

Eigenständige Client-freie Komponente. Props:

```ts
type WineHeroCardProps = {
  wine: { id: string; name: string; producer: string | null; vintage: number | null; type: WineType }
}
```

Visuelles Detail:
- Hintergrund: typ-spezifischer `linear-gradient(160deg, ...)` identisch zu `TYPE_CONFIG` in `app/wine/[id]/page.tsx`
- `min-height: 180px`, Inhalt bottom-aligned via `flex flex-col justify-end`
- Text-Overlay: `linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 60%)`
- Produzent: DM Mono, 0.68rem, uppercase, `rgba(255,255,255,0.65)`, `letter-spacing: 0.08em`
- Weinname: Cormorant Garamond, `clamp(1.4rem, 5vw, 1.8rem)`, weight 700, weiß, `letter-spacing: var(--tracking-tight)`
- Jahrgang: inline nach Weinname, kursiv, 0.8em, opacity 0.75
- Typ-Badge: bottom-right, gleicher Badge mit Dot-Indikator wie Wine-Cards, auf dunklem Grund (weiße Farbe)
- Border-radius: `var(--radius-xl)`, kein Border, `var(--shadow-lg)`
- Gesamte Card ist `<Link href="/wine/{id}">` — Tap navigiert zur Detailseite
- Kein Foto — Gradient ist das visuelle Mittel

### `components/dashboard/tasting-card.tsx` (extrahiert)

Aus `app/history/page.tsx` extrahierter Markup — beide Seiten (Dashboard + Chronik) nutzen dieselbe Komponente. Props:

```ts
type TastingCardProps = {
  tasting: { id: string; date: string; rating: number; notes: string | null }
  wine: { name: string; producer: string | null; vintage: number | null }
}
```

Visuelles Detail (identisch Chronik):
- Karte: `var(--card)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-lg)`, `var(--shadow-sm)`
- Produzent: `eyebrow` class
- Weinname: Cormorant Garamond, `var(--text-xl)`, weight 600
- Datum: DM Mono, `var(--text-xs)`, `var(--muted-foreground)`
- Rating: Cormorant, `var(--text-2xl)`, weight 700, `var(--primary)`, rechts aligned
- Trennlinie + Notes: `.rule-gold` separator, dann Notes kursiv — nur wenn `notes` vorhanden

### `components/dashboard/stats-card.tsx` (angepasst)

Bestehende Komponente. Zahl wird auf Cormorant Garamond Display-Font umgestellt (wie Flaschenanzahl auf Wine-Cards). Label bleibt `eyebrow`.

## Datenabruf (`app/page.tsx`)

Bestehende Queries bleiben. Neue Query hinzu:

```ts
const { data: latestWine } = await admin
  .from('wines')
  .select('id, name, producer, vintage, type')
  .eq('cellar_id', cellar.id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```

Alle Queries laufen parallel in `Promise.all`.

Der bestehende `recentTastings`-Query wird erweitert um `cellar_entries(wines(name, producer))` — damit `TastingCard` Weinname + Produzent anzeigen kann.

## Leerer Zustand

Wenn `latestWine === null` (kein Wein im Keller): Bottle-Glyph (bestehend) + Text "Der Keller ist noch leer." + `<Link>` Button "Ersten Wein hinzufügen" → `/wine/new`. Kein Hero, keine Stats, kein Tastings-Abschnitt.

## Was sich nicht ändert

- URL bleibt `/`
- Auth-Guard bleibt unverändert
- Membership/Cellar-Lookup bleibt unverändert
- Bottom-Nav und Top-Bar unberührt
- Kein Client-State, kein `'use client'` auf der Page

## Out of Scope

- Wein des Tages (rotierend) — bewusst nicht, da Ansatz B verworfen
- Quick-Action-Buttons — bewusst nicht, da Ansatz C verworfen
- Personalisierter Name im Greeting — kein Nutzer-Profil vorhanden
