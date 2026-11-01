'use client'

import { useState } from 'react'
import { usePowerSync } from '@powersync/react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

// Pure inventory event: decrements the sku's quantity, flips status at
// zero, and records who opened it (for the "Offene Flaschen ohne
// Bewertung" reminder -- see lib/powersync/queries.ts). Rating is a fully
// separate, optional action (AddTastingSheet, app/app/add-tasting-sheet.tsx)
// that can happen any time after this, or never -- see
// docs/specs/open-rate-separation.md for why these used to be one form.
export function OpenBottleButton({ skuId, quantity }: { skuId: string; quantity: number }) {
  const db = usePowerSync()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleOpen() {
    setIsPending(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Nicht angemeldet')

      const newQuantity = quantity - 1
      await db.execute(
        `UPDATE skus SET quantity = ?, status = ?, opened_by = ? WHERE id = ?`,
        [newQuantity, newQuantity <= 0 ? 'consumed' : 'in_stock', session.user.id, skuId],
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehlgeschlagen')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-1">
      <Button variant="outline" size="sm" onClick={handleOpen} disabled={isPending}>
        Flasche öffnen
      </Button>
      {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
    </div>
  )
}
