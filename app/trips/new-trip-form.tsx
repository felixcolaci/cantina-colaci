'use client'

import { createTrip } from '@/lib/actions/trips'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useState } from 'react'
import { Plus } from 'lucide-react'

export function NewTripForm() {
  const [open, setOpen] = useState(false)
  const { run, isPending, error } = useServerAction(createTrip)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button className="w-full" />}>
        <Plus className="h-4 w-4 mr-2" />Neue Reise
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader><SheetTitle>Neue Reise</SheetTitle></SheetHeader>
        <form
          onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
          className="space-y-4 mt-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" placeholder="Toskana Sommer 2026" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Ort</Label>
            <Input id="location" name="location" placeholder="Toskana, Italien" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date_start">Beginn</Label>
              <Input id="date_start" name="date_start" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_end">Ende</Label>
              <Input id="date_end" name="date_end" type="date" />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Reise anlegen</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
