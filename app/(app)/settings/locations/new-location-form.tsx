'use client'

import { createLocation } from '@/lib/actions/storage-locations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const typeLabels = [
  { value: 'fridge', label: 'Kühlschrank' },
  { value: 'cellar', label: 'Keller' },
  { value: 'climate_cabinet', label: 'Klimaschrank' },
  { value: 'other', label: 'Sonstiges' },
]

export function NewLocationForm() {
  return (
    <form action={createLocation} className="space-y-3 p-4 rounded-lg border">
      <h3 className="font-medium">Neuer Lagerort</h3>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="z. B. Klimaschrank Treppe" required />
      </div>
      <div className="space-y-2">
        <Label>Typ</Label>
        <Select name="type" required items={typeLabels}>
          <SelectTrigger><SelectValue placeholder="Typ auswählen" /></SelectTrigger>
          <SelectContent>
            {typeLabels.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" size="sm">Hinzufügen</Button>
    </form>
  )
}
