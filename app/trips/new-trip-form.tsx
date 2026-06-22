'use client'

import { useState } from 'react'
import { createTrip } from '@/lib/actions/trips'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Plus } from 'lucide-react'

export function NewTripForm() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button className="w-full" />}>
        <Plus className="h-4 w-4 mr-2" />Nuovo viaggio
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader><SheetTitle>Nuovo viaggio</SheetTitle></SheetHeader>
        <form action={createTrip} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" name="name" placeholder="Toscana Estate 2026" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Luogo</Label>
            <Input id="location" name="location" placeholder="Toscana, Italia" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date_start">Inizio</Label>
              <Input id="date_start" name="date_start" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_end">Fine</Label>
              <Input id="date_end" name="date_end" type="date" />
            </div>
          </div>
          <Button type="submit" className="w-full">Crea viaggio</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
