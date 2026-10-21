'use client'

import { useState } from 'react'
import { usePowerSync } from '@powersync/react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

// Decrements a sku's quantity by one and flips it to 'consumed' once it
// hits zero -- the inventory half of the legacy openBottle action
// (lib/actions/tasting.ts), which also inserted a tasting row in the same
// transaction. That half isn't built yet (Verkostungen is a later
// migration); it should either extend this component's onConfirm or add its
// own write alongside it once tastings can be created from the SPA.
export function OpenBottleButton({ skuId, quantity }: { skuId: string; quantity: number }) {
  const db = usePowerSync()
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setIsPending(true)
    setError(null)
    try {
      const newQuantity = quantity - 1
      await db.execute(
        `UPDATE skus SET quantity = ?, status = ? WHERE id = ?`,
        [newQuantity, newQuantity <= 0 ? 'consumed' : 'in_stock', skuId],
      )
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehlgeschlagen')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Flasche öffnen
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flasche öffnen?</DialogTitle>
          <DialogDescription>
            Reduziert den Bestand um eine Flasche
            {newQuantityLabel(quantity)}.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Wird geöffnet…' : 'Öffnen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function newQuantityLabel(quantity: number): string {
  const remaining = quantity - 1
  return remaining <= 0
    ? ' und markiert diesen Posten als verbraucht'
    : ` (${remaining} verbleiben)`
}
