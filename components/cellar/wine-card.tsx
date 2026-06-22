import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Wine, CellarEntry } from '@/lib/types'

const typeLabel: Record<string, string> = {
  red: 'Rotwein', white: 'Weißwein', rosé: 'Rosé', sparkling: 'Schaumwein',
}

interface WineCardProps {
  wine: Wine
  entries: Pick<CellarEntry, 'quantity' | 'photo_url'>[]
}

export function WineCard({ wine, entries }: WineCardProps) {
  const totalBottles = entries.reduce((sum, e) => sum + e.quantity, 0)
  const photo = entries.find(e => e.photo_url)?.photo_url

  return (
    <Link href={`/wine/${wine.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-3 flex gap-3 items-center">
          {photo ? (
            <img src={photo} alt={wine.name} className="w-10 h-14 object-cover rounded shrink-0" />
          ) : (
            <div className="w-10 h-14 bg-muted rounded flex items-center justify-center text-xl shrink-0">🍷</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{wine.name}</p>
            <p className="text-sm text-muted-foreground truncate">{wine.producer}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {wine.vintage && <span className="text-xs text-muted-foreground">{wine.vintage}</span>}
              <Badge variant="outline" className="text-xs">{typeLabel[wine.type]}</Badge>
              {wine.region && <span className="text-xs text-muted-foreground">{wine.region}</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold">{totalBottles}</p>
            <p className="text-xs text-muted-foreground">Fl.</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
