import type { ParsedRowValues } from './validate-row'

// Minimale Teilmenge der PowerSync-DB-API, die dieses Modul braucht --
// erlaubt, im Test eine einfache Fake-Implementierung statt der echten
// PowerSync-Instanz zu übergeben.
export type ImportDb = {
  getOptional<T>(sql: string, params?: unknown[]): Promise<T | null>
  writeTransaction<T>(callback: (tx: ImportTx) => Promise<T>): Promise<T>
}
export type ImportTx = {
  execute(sql: string, params?: unknown[]): Promise<unknown>
}

export type CommitResult = {
  imported: number
  failed: number
  errors: { index: number; message: string }[]
}

export function matchKey(name: string, producer: string): string {
  return `${name.trim().toLowerCase()}|${producer.trim().toLowerCase()}`
}

/**
 * Schreibt jede Zeile als eigene `writeTransaction`, strikt sequenziell
 * (kein Promise.all) -- absichtlich so, damit eine spätere Zeile im selben
 * Import einen von einer früheren Zeile gerade neu angelegten Wein per
 * Name+Produzent matchen kann: der `getOptional`-Lookup einer Zeile läuft
 * erst, nachdem die writeTransaction der vorherigen Zeile bereits
 * abgeschlossen (und damit lokal sichtbar) ist.
 */
export async function commitImportRows(
  db: ImportDb,
  cellarId: string,
  rows: ParsedRowValues[],
): Promise<CommitResult> {
  const result: CommitResult = { imported: 0, failed: 0, errors: [] }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const existing = await db.getOptional<{ id: string }>(
        `SELECT id FROM wines WHERE cellar_id = ? AND lower(trim(name)) = ? AND lower(trim(producer)) = ?`,
        [cellarId, row.name.trim().toLowerCase(), row.producer.trim().toLowerCase()],
      )

      const wineId = existing?.id ?? crypto.randomUUID()
      const skuId = crypto.randomUUID()

      await db.writeTransaction(async tx => {
        if (!existing) {
          await tx.execute(
            `INSERT INTO wines (id, cellar_id, name, producer, type) VALUES (?, ?, ?, ?, ?)`,
            [wineId, cellarId, row.name, row.producer, row.type],
          )

          // PUT /api/v1/wines/[id] (Insert-Endpunkt) akzeptiert diese vier
          // Felder beim Insert nicht und setzt sie hart auf null -- siehe
          // Spec "Wichtiger Hinweis". Ein UPDATE direkt danach läuft über
          // den PATCH-Endpunkt, der sie korrekt persistiert (gleiches
          // Statement wie app/app/wine-edit-sheet.tsx).
          if (row.region || row.country || row.grape_variety || row.notes) {
            await tx.execute(
              `UPDATE wines SET region = ?, country = ?, grape_variety = ?, notes = ? WHERE id = ?`,
              [row.region, row.country, row.grape_variety, row.notes, wineId],
            )
          }
        }

        await tx.execute(
          `INSERT INTO skus
             (id, wine_id, vintage, quantity, storage_location_id, status, purchase_price, purchase_date, purchase_location, shelf_location, trip_id, photo_path)
           VALUES (?, ?, ?, ?, NULL, 'in_stock', ?, ?, ?, ?, NULL, NULL)`,
          [skuId, wineId, row.vintage, row.quantity, row.purchase_price, row.purchase_date, row.purchase_location, row.shelf_location],
        )
      })

      result.imported++
    } catch (err) {
      result.failed++
      result.errors.push({ index: i, message: err instanceof Error ? err.message : 'Unbekannter Fehler' })
    }
  }

  return result
}
