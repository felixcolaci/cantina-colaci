'use client'

import { useState } from 'react'
import { clearDemoCellar } from '@/lib/actions/demo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription,
} from '@/components/ui/sheet'

export function StartOwnCellar() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button className="w-full" />}>
        Eigene Cantina starten
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Eigene Cantina starten</SheetTitle>
          <SheetDescription>
            Die Demo-Weine werden gelöscht. Du startest mit einer leeren Cantina.
          </SheetDescription>
        </SheetHeader>
        <form action={clearDemoCellar} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="cellarName">Name deiner Cantina</Label>
            <Input
              id="cellarName"
              name="cellarName"
              defaultValue="Meine Cantina"
              required
            />
          </div>
          <Button type="submit" className="w-full">Demo löschen und starten</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
