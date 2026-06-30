'use client'

import { deleteLocation } from '@/lib/actions/storage-locations'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { StorageLocation } from '@/lib/types'

const typeLabels: Record<string, string> = {
  fridge: 'Kühlschrank',
  cellar: 'Keller',
  climate_cabinet: 'Klimaschrank',
  other: 'Sonstiges',
}

export function LocationList({ locations }: { locations: StorageLocation[] }) {
  if (locations.length === 0) {
    return <p className="text-muted-foreground text-sm py-4 text-center">Noch keine Lagerorte</p>
  }

  return (
    <div className="space-y-2">
      {locations.map(loc => (
        <div key={loc.id} className="flex items-center justify-between p-3 rounded-lg border">
          <div>
            <p className="font-medium">{loc.name}</p>
            <Badge variant="secondary" className="text-xs mt-1">{typeLabels[loc.type]}</Badge>
          </div>
          <form action={deleteLocation}>
            <input type="hidden" name="id" value={loc.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              Löschen
            </Button>
          </form>
        </div>
      ))}
    </div>
  )
}
