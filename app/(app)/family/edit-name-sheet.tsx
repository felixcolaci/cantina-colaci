'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { setDisplayName } from '@/lib/actions/family'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'

export function EditNameSheet({ currentName }: { currentName: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={
        <button
          aria-label="Namen bearbeiten"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--muted-foreground)',
            padding: 'var(--space-1)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Pencil size={14} />
        </button>
      } />
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Namen ändern</SheetTitle>
        </SheetHeader>
        <form action={setDisplayName} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Anzeigename</Label>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={currentName}
              maxLength={40}
            />
          </div>
          <Button type="submit" className="w-full">Speichern</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
