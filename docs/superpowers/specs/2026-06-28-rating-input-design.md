# Rating Input Redesign — Spec

**Datum:** 2026-06-28  
**Status:** Approved

## Ziel

Den plain `<Input type="number" min="1" max="10">` im "Flasche öffnen"-Sheet durch eine visuelle 5-Punkte-Auswahl ersetzen und die Anzeige überall von `/10` auf `/5` umstellen.

## Skala

1–5 (Integer). Bestehende Ratings (1–10) werden nicht migriert — sie erscheinen nach dem Update als `X/5`. Der Datensatz ist klein genug für manuelle Korrektur falls nötig.

---

## Komponente: `components/ui/rating-input.tsx` (neu)

Eigenständige Client-Komponente, isoliert testbar.

**Props:**
```ts
type RatingInputProps = {
  name: string
  value: number | null
  onChange: (v: number) => void
}
```

**Layout:** `grid grid-cols-5 gap-2` — 5 gleichgroße Buttons.

**Button-Stil:**
- Unausgewählt: `background: var(--parchment)`, `color: var(--ink-700)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-md)`
- Ausgewählt: `background: var(--primary)`, `color: white`, kein Border
- Zahl: `var(--font-display)` (Cormorant Garamond), `var(--text-xl)`, weight 700
- Höhe: `52px`
- Transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)`

**Hidden input:** `<input type="hidden" name={name} value={value ?? ''} />` — liefert den Wert bei Form-Submission. Wenn `value === null` (nichts ausgewählt), ist der Wert leer.

---

## Integration: `app/wine/[id]/open-bottle-button.tsx`

- Import `RatingInput` hinzufügen
- Neuer State: `const [rating, setRating] = useState<number | null>(null)`
- `<Input id="rating" name="rating" type="number" min="1" max="10" required />` ersetzen durch:
  ```tsx
  <RatingInput name="rating" value={rating} onChange={setRating} />
  ```
- Label von "Bewertung (1–10)" auf "Bewertung" ändern
- `import { Input }` entfernen — nach diesem Plan kein Input-Feld mehr in der Datei

---

## Anzeigeänderungen `/5`

Drei Stellen, alle mechanisch:

| Datei | Änderung |
|-------|----------|
| `components/dashboard/tasting-card.tsx` | `/10` → `/5` im Rating-Suffix |
| `app/wine/[id]/page.tsx` | `/10` → `/5` in der Tastings-Sektion |
| `app/history/page.tsx` | Erbt Änderung automatisch über `TastingCard` |

---

## Was sich nicht ändert

- DB-Schema — kein Migrations-Skript
- `lib/actions/tasting.ts` — `openBottle` bleibt unverändert
- Alle anderen Formularfelder im Sheet bleiben unverändert
