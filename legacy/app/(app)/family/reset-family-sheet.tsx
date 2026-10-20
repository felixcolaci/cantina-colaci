'use client'

import { useState } from 'react'
import { resetFamily } from '@/lib/actions/reset'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription,
} from '@/components/ui/sheet'

export function ResetFamilySheet({ familyName }: { familyName: string }) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const canSubmit = confirmText === familyName

  return (
    <Sheet
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) setConfirmText('')
      }}
    >
      <SheetTrigger render={<Button variant="destructive" className="w-full" />}>
        Familie zurücksetzen
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Familie zurücksetzen</SheetTitle>
          <SheetDescription>
            Alle Weine, Flaschen, Fotos, Verkostungen, Reisen und Lagerorte in
            jedem Keller von &quot;{familyName}&quot; werden unwiderruflich
            gelöscht. Familie und Mitglieder bleiben bestehen.
          </SheetDescription>
        </SheetHeader>
        <form action={resetFamily} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="confirm">Gib zur Bestätigung &quot;{familyName}&quot; ein</Label>
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
