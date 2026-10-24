# CSV/Excel-Import für Weine — Spec

**Datum:** 2026-10-24
**Status:** Approved

## Kontext

Weine kommen heute nur einzeln über `QuickAddSheet` in den Keller ("Wein hinzufügen"). Das ist mühsam, wenn jemand eine ganze Kiste gemischter Weine von einer Reise nachträgt oder einen bestehenden Bestand (z. B. aus einer alten Tabelle oder einem anderen Tool) auf einmal übernehmen will. Der Import soll beide Fälle abdecken: eine Hand voll Zeilen nach einem Einkauf genauso wie eine einmalige Migration eines kompletten Kellers (geschätzt bis zu einigen hundert Zeilen).

Ziel ist ein Wizard: Datei hochladen (CSV oder Excel) → erkannte Spalten per Hand auf unsere Zielfelder mappen → Vorschau mit Zeilen-Validierung, Fehler editierbar/abwählbar → Bestätigen. Jede importierte Zeile erzeugt einen Wein **und** einen SKU (Jahrgangs-/Kaufposten) — die gleiche Kombination, die `QuickAddSheet` heute für eine einzelne Flasche anlegt.

## User Stories

- Als Familienmitglied möchte ich eine CSV- oder Excel-Datei mit mehreren Weinen hochladen, statt jeden einzeln über das Formular einzutippen.
- Als Familienmitglied möchte ich selbst festlegen, welche Spalte meiner Datei welchem Feld in Cantina Colaci entspricht, weil meine Datei nicht die gleichen Spaltennamen hat.
- Als Familienmitglied möchte ich vor dem endgültigen Import sehen, welche Zeilen Probleme haben (fehlender Pflichtwert, ungültige Zahl/Typ), und diese Zeilen entweder direkt korrigieren oder einzeln vom Import ausschließen.
- Als Familienmitglied möchte ich, dass eine importierte Zeile, die zu einem bereits im Keller vorhandenen Wein passt (gleicher Name + Produzent), nicht als doppelter Wein-Eintrag landet, sondern als neuer Posten (SKU) an den bestehenden Wein gehängt wird.
- Als Familienmitglied möchte ich nach dem Import eine klare Rückmeldung, wie viele Zeilen übernommen wurden.

## Terminologie

| Technisch | UI-Text |
|-----------|---------|
| Import-Wizard | "Weine importieren" |
| Spalten-Mapping | "Spalten zuordnen" |
| Zeilen-Vorschau | "Vorschau" |
| `matched` (Zeile→bestehender Wein) | "bereits im Keller" |

## Lösungsentwurf: Schritte des Wizards

1. **Datei wählen**: `.csv` oder `.xlsx`. Client-seitiges Parsen (kein Server-Roundtrip für die Rohdatei — Datei bleibt auf dem Gerät, konsistent mit dem sonst lokalen/offline-first Schreibpfad). Legacy-`.xls` (vor-2007-Binärformat) wird bewusst nicht unterstützt, siehe Technical Requirements.
2. **Spalten zuordnen**: Erkannte Spaltenüberschriften (erste Zeile der Datei) werden einer Liste von Zielfeldern gegenübergestellt (Dropdown pro Spalte, oder umgekehrt — ein Dropdown pro Zielfeld mit den erkannten Spalten als Optionen). Ziel-Mapping wird anhand von Spaltennamen-Heuristik vorbelegt (z. B. Spalte "Produzent"/"Winery"/"Producer" → `producer`), bleibt aber frei änderbar. Pflichtfelder (`name`, `producer`, `type`) müssen zugeordnet sein, bevor es weitergeht; alle anderen Zielfelder sind optional und können "nicht importieren" bleiben.
3. **Vorschau**: Tabelle mit einer Zeile pro Datenzeile der Quelldatei, Spalten = die gemappten Zielfelder. Jede Zeile wird client-seitig validiert (siehe Validierungsregeln unten) und zusätzlich gegen den aktuellen Kellerbestand auf einen Match (Name+Produzent, case-insensitive, getrimmt) geprüft. Zeilen mit Fehlern sind markiert, der fehlerhafte Wert ist inline editierbar; jede Zeile hat eine Checkbox (Default: an, außer bei Fehlern — dort Default: aus) zum Ein-/Ausschließen vom Import. "Bereits im Keller"-Zeilen bekommen ein Badge mit dem Namen des bestehenden Weins.
4. **Bestätigen**: Button zeigt die Anzahl der aktuell ausgewählten, fehlerfreien Zeilen ("12 Weine importieren"). Beim Klick werden alle ausgewählten Zeilen nacheinander geschrieben (siehe Technical Requirements), danach eine Zusammenfassung ("12 importiert, 2 übersprungen") und der Wizard schließt.

## Technical Requirements

### Entry Point

Neuer Button `ImportWineDialog`/Trigger direkt neben dem bestehenden `QuickAddSheet`-Trigger in der Quick-Links-Zeile von `app/app/cellar-screen.tsx` (z. B. Icon `Upload` aus `lucide-react`).

### Parsing

- **Entschieden gegen `xlsx` (SheetJS)**: die aktuelle npm-Registry-Version (0.18.5) hat zwei ungepatchte High-Severity-CVEs (Prototype Pollution, ReDoS; `npm audit` meldet `fixAvailable: false`), da SheetJS gepatchte Versionen nur noch über ein eigenes CDN außerhalb der npm-Registry verteilt. Für eine Funktion, deren ganzer Zweck das Parsen von Dateien ist, die Nutzer selbst hochladen, wiegt das schwerer als sonst.
- Stattdessen: `exceljs` (aktiv gepflegt, npm-Registry, nur ein moderates, praktisch nicht erreichbares transitives Advisory über `uuid`) für `.xlsx` — `new ExcelJS.Workbook().xlsx.load(buffer)` → erstes Sheet → `sheet.eachRow({ includeEmpty: true }, ...)` für Rohzeilen inkl. Header-Zeile.
- `.csv` über einen winzigen selbst geschriebenen RFC4180-Parser (Anführungszeichen, `""`-Escape, eingebettete Kommas/Zeilenumbrüche) — kein zusätzliches Paket nötig, da CSV ohnehin kein Binärformat ist.
- Erste Zeile der Datei = Spaltenüberschriften. Keine Mehrfach-Sheet-Unterstützung in v1 (immer erstes Sheet aus der `.xlsx`-Datei).
- Datei komplett im Browser geparst (`File.text()`/`File.arrayBuffer()`), keine Serverkomponente beteiligt.

### Ziel-Felder und Mapping

| Zielfeld | Tabelle | Pflicht | Typ/Validierung |
|---|---|---|---|
| `name` | wines | ✅ | nicht-leerer Text |
| `producer` | wines | ✅ (DB `not null`, leer wird zu `''`) | Text |
| `type` | wines | ✅ | muss auf `red`/`white`/`rosé`/`sparkling` abbildbar sein (siehe Typ-Mapping unten) |
| `region` | wines | – | Text |
| `country` | wines | – | Text |
| `grape_variety` | wines | – | Text |
| `notes` | wines | – | Text |
| `vintage` | skus | – | 4-stellige Ganzzahl, Jahr zwischen 1900 und aktuellem Jahr |
| `quantity` | skus | – (Default 1) | positive Ganzzahl |
| `purchase_price` | skus | – | Zahl ≥ 0 |
| `purchase_date` | skus | – | Datum, tolerant geparst (ISO `YYYY-MM-DD`, `DD.MM.YYYY`, `DD/MM/YYYY`) |
| `purchase_location` | skus | – | Text |
| `shelf_location` | skus | – | Text |

`storage_location_id` und `trip_id` (beide FK auf bestehende Entitäten) sind **nicht** mappbar — siehe Out of Scope.

**Typ-Mapping**: Freitext-Werte in der Quelldatei (z. B. "Rotwein", "Red", "rot") werden über eine feste Synonym-Tabelle auf die vier erlaubten Typ-Werte abgebildet (analog zur Spaltennamen-Heuristik beim Mapping-Schritt). Ein Wert, der auf keinen der vier Typen abbildbar ist, macht die Zeile fehlerhaft (siehe Validierung) — kein stiller Fallback auf einen Default-Typ, damit kein Wein versehentlich falsch kategorisiert wird.

### Schreibpfad (clientseitig, pro bestätigter Zeile)

Wiederverwendung des bestehenden lokalen Schreibpfads aus `app/app/quick-add-sheet.tsx` (`db.writeTransaction`), **kein neuer Server-Endpunkt**. Für jede bestätigte Zeile:

1. **Match-Lookup**: `SELECT id FROM wines WHERE cellar_id = ? AND lower(trim(name)) = ? AND lower(trim(producer)) = ?` gegen die lokale PowerSync-Tabelle (bereits synced Kellerbestand).
   - Treffer → `wineId` = gefundene ID, **kein** neuer `wines`-Insert für diese Zeile.
   - Kein Treffer → neue `wineId` (`crypto.randomUUID()`), Insert wie unten.
2. Falls neuer Wein: `INSERT INTO wines (id, cellar_id, name, producer, type) VALUES (...)` — genau wie `QuickAddSheet` heute, **bewusst ohne** `region`/`country`/`grape_variety`/`notes` im Insert (siehe wichtiger Hinweis unten). Direkt im Anschluss, **innerhalb derselben lokalen Transaktion**, falls mindestens eines dieser vier optionalen Felder gemappt und für die Zeile gesetzt ist: `UPDATE wines SET region = ?, country = ?, grape_variety = ?, notes = ? WHERE id = ?` (gleiches Statement wie in `app/app/wine-edit-sheet.tsx`).
3. `INSERT INTO skus (id, wine_id, vintage, quantity, storage_location_id, status, purchase_price, purchase_date, purchase_location, shelf_location, trip_id, photo_path) VALUES (?, ?, ?, ?, NULL, 'in_stock', ?, ?, ?, ?, NULL, NULL)`.

**Wichtiger Hinweis (bestehende Einschränkung, kein neuer Bug)**: `PUT /api/v1/wines/[id]` (der Insert-Endpunkt, den der PowerSync-Upload-Connector für einen neuen `wines`-Datensatz anspricht) akzeptiert beim Insert aktuell nur `name`/`producer`/`type` und setzt `region`/`country`/`grape_variety`/`notes` hart auf `null` — unabhängig davon, was im Request-Body steht. Würde der Import diese vier Felder direkt im `INSERT` mitschreiben, gingen sie beim nächsten Server-Roundtrip verloren. Der zusätzliche `UPDATE` in Schritt 2 vermeidet das, weil er über den bereits vorhandenen `PATCH`-Endpunkt läuft, der diese Felder korrekt persistiert (siehe `app/api/v1/wines/[id]/route.ts` PATCH-Handler, genutzt von `wine-edit-sheet.tsx`). Kein Code auf Server-Seite ändert sich dafür.

Alle bestätigten Zeilen werden sequenziell verarbeitet (eine `writeTransaction` pro Zeile, nicht eine große Transaktion für die ganze Datei) — ein Fehler bei einer Zeile (z. B. unerwarteter DB-Fehler) blockiert nicht die restlichen Zeilen; die Zusammenfassung am Ende zählt Erfolge/Fehler getrennt.

### UI-Komponenten

- Neuer `app/app/import-wines-dialog.tsx`, `Dialog` (nicht `Sheet` — mehrstufiger Wizard mit Tabelle braucht mehr Breite als ein Bottom-Sheet) mit internem Step-State (`'upload' | 'mapping' | 'preview'`).
- Vorschau-Tabelle: einfache HTML-`<table>`, kein neues Table-UI-Component nötig (keines vorhanden, siehe `components/ui/`); Zellen mit Fehler bekommen inline `<Input>` zur Korrektur (gleiche `components/ui/input.tsx`).
- Mapping-Schritt: pro Zielfeld ein `Select` (`components/ui/select.tsx`) mit den erkannten Spaltenüberschriften als Optionen plus "nicht importieren".

## Validierungsregeln (Vorschau-Schritt)

- `name` leer → Fehler "Name fehlt".
- `type` nicht auf einen der vier Werte abbildbar (weder direkter Match noch über Synonym-Tabelle) → Fehler "Unbekannter Typ: <Wert>".
- `vintage` gesetzt, aber keine Ganzzahl oder außerhalb 1900–aktuelles Jahr → Fehler "Ungültiger Jahrgang".
- `quantity` gesetzt, aber keine positive Ganzzahl → Fehler "Ungültige Anzahl" (leer/nicht gemappt → Default 1, kein Fehler).
- `purchase_price` gesetzt, aber keine Zahl ≥ 0 → Fehler "Ungültiger Preis".
- `purchase_date` gesetzt, aber in keinem der unterstützten Formate parsbar → Fehler "Ungültiges Datum".
- `producer` leer ist **kein** Fehler (DB erlaubt `''`), aber eine Zeile ohne `producer` kann nie auf einen bestehenden Wein matchen, der einen Produzenten hat.

## Acceptance Criteria

- [ ] Given eine CSV-Datei mit Kopfzeile und 5 Datenzeilen, when sie im Wizard hochgeladen wird, then zeigt der Mapping-Schritt alle erkannten Spaltenüberschriften zur Auswahl an.
- [ ] Given eine Spalte heißt "Winzer" oder "Produzent", when der Mapping-Schritt angezeigt wird, then ist sie automatisch auf das Zielfeld `producer` vorbelegt (Heuristik), bleibt aber änderbar.
- [ ] Given alle Pflichtfelder (`name`, `producer`, `type`) sind im Mapping-Schritt zugeordnet, when "Weiter" geklickt wird, then erscheint die Vorschau-Tabelle mit allen Datenzeilen.
- [ ] Given eine Zeile hat einen leeren `name`, when die Vorschau gerendert wird, then ist diese Zeile als fehlerhaft markiert, ihre Auswahl-Checkbox ist standardmäßig deaktiviert, und der Import-Button zählt sie nicht mit.
- [ ] Given der Nutzer korrigiert den fehlerhaften Wert einer Zeile direkt in der Vorschau-Tabelle, when der neue Wert gültig ist, then verschwindet die Fehlermarkierung und die Zeile kann wieder ausgewählt werden.
- [ ] Given eine Zeile hat `name`+`producer`, die (case-insensitive, getrimmt) exakt zu einem bereits im Keller vorhandenen Wein passen, when die Vorschau gerendert wird, then zeigt die Zeile ein "bereits im Keller"-Badge, und der Import erzeugt für diese Zeile **keinen** neuen `wines`-Datensatz, sondern nur einen neuen `skus`-Datensatz mit `wine_id` des bestehenden Weins.
- [ ] Given eine Zeile mit gemapptem `region`/`country`/`grape_variety`/`notes` und keinem Match zu einem bestehenden Wein, when der Import läuft, then hat der neu angelegte Wein diese Felder lokal gesetzt **und** sie sind nach einem erneuten vollständigen Sync (lokale DB löschen + neu syncen, oder auf einem zweiten Gerät öffnen) weiterhin vorhanden (nicht durch den Server-Roundtrip auf `null` zurückgesetzt).
- [ ] Given 10 ausgewählte, fehlerfreie Zeilen, when "Weine importieren" geklickt wird, then entstehen lokal sofort 10 (oder weniger, bei Matches) neue `wines`- und 10 neue `skus`-Zeilen, der Wizard schließt mit einer Erfolgsmeldung ("10 importiert"), und PowerSync queued den Upload wie bei jedem anderen lokalen Insert.
- [ ] Given eine Excel-Datei (`.xlsx`) mit denselben Daten wie eine äquivalente CSV-Datei, when beide separat importiert werden, then ist das Ergebnis identisch (beide Parser liefern die gleiche `{ headers, rows }`-Struktur).

## Edge Cases und Fehlerzustände

- Datei ohne Kopfzeile / mit leerer erster Zeile → Mapping-Schritt zeigt generische Spaltennamen ("Spalte 1", "Spalte 2", …) als Fallback, keine Heuristik greift, Nutzer muss alles manuell zuordnen.
- Datei komplett leer (0 Datenzeilen nach der Kopfzeile) → Fehlermeldung direkt nach dem Upload-Schritt, Wizard bleibt auf Schritt 1.
- Datei mit über ~500 Zeilen → kein hartes Limit in v1, aber keine spezielle Performance-Optimierung (Virtualisierung o. Ä.) für die Vorschau-Tabelle; das ist eine bekannte Grenze, kein Blocker für diese Spec, da der erwartete Regelfall einige Dutzend bis wenige hundert Zeilen sind.
- Zwei Zeilen in derselben Datei matchen auf denselben bestehenden Wein (z. B. zwei verschiedene Jahrgänge desselben Weins) → beide bekommen das "bereits im Keller"-Badge, beide erzeugen je einen neuen `skus`-Datensatz an diesem einen Wein — kein Konflikt, das ist der Normalfall (mehrere Jahrgänge eines Weins).
- Zwei Zeilen in derselben Datei haben identischen `name`+`producer`, matchen aber auf **keinen** bestehenden Wein (beide neu) → die zweite Zeile matcht beim Schreiben auf den von der ersten Zeile soeben angelegten Wein (Match-Lookup läuft sequenziell je Zeile, inklusive der innerhalb des Imports selbst neu geschriebenen), bekommt also ebenfalls nur einen neuen SKU, keinen zweiten Wein — konsistent mit der Matching-Regel.
- Datumsfeld in einem von der Bibliothek erkannten Excel-Datumsformat (Excel speichert Daten intern als Zahl) → `XLSX` liefert dafür bereits ein JS-`Date`-Objekt bzw. eine serielle Zahl je nach Zelltyp; beides wird in der Validierung zusätzlich zu den drei Text-Datumsformaten akzeptiert.
- Abbruch des Wizards (Dialog schließen) nach dem Mapping, aber vor dem Bestätigen → keine Schreibvorgänge, nichts wird verworfen, weil nichts angelegt wurde.
- Browser-Tab wird während eines laufenden Imports (viele Zeilen) geschlossen → bereits geschriebene Zeilen (frühere `writeTransaction`-Aufrufe) bleiben als lokale PowerSync-Zeilen bestehen und werden normal hochgeladen; nicht erreichte Zeilen gehen verloren, kein Resume in v1.

## Out of Scope

- Zuordnung einer importierten Zeile zu einer bestehenden `storage_location_id` oder einem `trip_id` (beide FK, keine Freitext-Spalten) — Import setzt beide immer auf `NULL`, Zuordnung erfolgt danach manuell über die bestehenden Bearbeiten-Flows.
- Foto-Import (z. B. Spalte mit Bild-URL) — Fotos bleiben ein rein manueller Upload wie heute.
- Mehrere Sheets pro Excel-Datei — immer nur das erste Sheet.
- Speichern/Wiederverwenden eines Spalten-Mappings für zukünftige Importe (kein "Vorlage speichern").
- Undo/Rückgängigmachen eines abgeschlossenen Imports (einzelne fehlerhaft importierte Weine müssen wie jeder andere Wein manuell gelöscht/bearbeitet werden).
- Fuzzy-Matching bestehender Weine (z. B. Tippfehler-Toleranz) — nur exakter, case-insensitiver Name+Produzent-Match.
- Import von Verkostungen (`tastings`) oder Entdeckungen (`discoveries`) über diesen Wizard — ausschließlich Weine + SKUs.
- Server-seitige Validierung/Verarbeitung der Datei — alles läuft clientseitig, der Server sieht nur die einzelnen resultierenden Insert/Update-Aufrufe, die PowerSync ohnehin für jede lokale Änderung auslöst.

## Offene Punkte zur Freigabe

1. ~~**Neue Abhängigkeit `xlsx` (SheetJS)**~~ — **entschieden**: `xlsx`@npm hat zwei ungepatchte High-Severity-CVEs, siehe Parsing-Abschnitt. Stattdessen `exceljs` für `.xlsx` + ein selbst geschriebener CSV-Parser; `.xls` (Legacy-Binärformat) dafür nicht mehr unterstützt.
2. **`UPDATE` direkt nach `INSERT` für `region`/`country`/`grape_variety`/`notes`** (wegen der bestehenden Lücke im `PUT`-Insert-Endpunkt) — ok als Workaround, oder soll stattdessen der `PUT /api/v1/wines/[id]`-Endpunkt selbst erweitert werden, diese Felder beim Insert zu akzeptieren (würde auch zukünftigen Callern helfen, ist aber ein Scope-Punkt, der über den Import hinausgeht)?
3. **Typ-Synonym-Tabelle** (z. B. "Rotwein"/"Red"/"rot" → `red`) — reicht eine feste, kleine Liste in Deutsch/Englisch, oder gibt es weitere Sprachen/Schreibweisen, die abgedeckt sein müssen?
