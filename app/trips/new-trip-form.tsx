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
import { DatePicker } from '@/components/ui/date-picker'

export function NewTripForm() {
  const [open, setOpen] = useState(false)
  const [dateStart, setDateStart] = useState<string | null>(null)
  const [dateEnd, setDateEnd] = useState<string | null>(null)
  const { run, isPending, error } = useServerAction(createTrip)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4 mr-1" />Hinzufügen
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
              <Label>Beginn</Label>
              <DatePicker
                mode="full"
                name="date_start"
                value={dateStart}
                onChange={v => setDateStart(v as string | null)}
                placeholder="Beginn"
              />
            </div>
            <div className="space-y-2">
              <Label>Ende</Label>
              <DatePicker
                mode="full"
                name="date_end"
                value={dateEnd}
                onChange={v => setDateEnd(v as string | null)}
                placeholder="Ende"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Reise anlegen</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
