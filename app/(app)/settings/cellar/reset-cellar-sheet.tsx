'use client'

import { useState } from 'react'
import { resetCellar } from '@/lib/actions/reset'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription,
} from '@/components/ui/sheet'

export function ResetCellarSheet({ cellarName }: { cellarName: string }) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const canSubmit = confirmText === cellarName

  return (
    <Sheet
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) setConfirmText('')
      }}
    >
      <SheetTrigger render={<Button variant="destructive" className="w-full" />}>
        Keller zurücksetzen
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Keller zurücksetzen</SheetTitle>
          <SheetDescription>
            Alle Weine, Flaschen, Fotos, Verkostungen, Reisen und Lagerorte in
            &quot;{cellarName}&quot; werden unwiderruflich gelöscht. Der Keller
            selbst bleibt bestehen und ist danach leer.
          </SheetDescription>
        </SheetHeader>
        <form action={resetCellar} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="confirm">Gib zur Bestätigung &quot;{cellarName}&quot; ein</Label>
            <Input
              id="confirm"
              name="confirm"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="destructive" className="w-full" disabled={!canSubmit}>
            Endgültig löschen
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
