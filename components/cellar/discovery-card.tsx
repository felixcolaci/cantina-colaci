'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePowerSync } from '@powersync/react'
import { apiGet } from '@/lib/spa/api-client'
import type { DiscoverySummary } from '@/lib/powersync/queries'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// Foto-URL kommt separat über react-query (GET /discoveries/[id]/photo),
// nicht aus dem lokalen PowerSync-Query -- discovery_photos ist bewusst
// nicht synchronisiert (siehe lib/api/discovery.ts).
export function DiscoveryCard({ discovery }: { discovery: DiscoverySummary }) {
  const db = usePowerSync()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const { data: photo } = useQuery<{ url: string | null }>({
    queryKey: ['discovery-photo', discovery.id],
    queryFn: () => apiGet<{ url: string | null }>(`/discoveries/${discovery.id}/photo`),
  })

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await db.execute(`DELETE FROM discoveries WHERE id = ?`, [discovery.id])
      queryClient.removeQueries({ queryKey: ['discovery-photo', discovery.id] })
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  const fundort = discovery.tripName ?? discovery.locationText

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-4)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {discovery.producer && <p className="eyebrow truncate mb-0.5">{discovery.producer}</p>}
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 600,
            lineHeight: 1.12, letterSpacing: '-0.01em', color: 'var(--foreground)',
          }}>
            {discovery.name}
            {discovery.vintage && (
              <span className="nums" style={{ color: 'var(--muted-foreground)', fontWeight: 500, fontStyle: 'italic' }}>
                {' '}{discovery.vintage}
              </span>
            )}
          </p>
          <p className="mono mt-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>
            {[fundort, new Date(discovery.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })]
              .filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="flex-none flex items-start gap-2">
          {discovery.rating != null && (
            <div className="text-right">
              <span className="nums" style={{
                fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700,
                lineHeight: 1, color: 'var(--primary)',
              }}>
                {discovery.rating}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>/5</span>
            </div>
          )}
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center justify-center w-7 h-7 rounded-full"
            style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
            aria-label="Entdeckung löschen"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {photo?.url && (
        // eslint-disable-next-line @next/next/no-img-element -- einmaliges, signiertes URL-Thumbnail
        <img src={photo.url} alt="" className="mt-3 rounded-md object-cover" style={{ width: '100%', height: 140 }} />
      )}

      {discovery.notes && (
        <>
          <hr className="my-3" style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', color: 'var(--foreground)', fontStyle: 'italic' }}>
            {discovery.notes}
          </p>
        </>
      )}

      {(discovery.price != null || discovery.createdByName) && (
        <p className="mt-2" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>
          {[
            discovery.price != null
              ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(discovery.price)
              : null,
            discovery.createdByName ? `Entdeckt von ${discovery.createdByName}` : null,
          ].filter(Boolean).join(' · ')}
        </p>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Entdeckung löschen?</DialogTitle>
            <DialogDescription>„{discovery.name}“ wird unwiderruflich entfernt.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Abbrechen</DialogClose>
            <Button variant="destructive" disabled={isDeleting} onClick={handleDelete}>Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
