'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}) {
  if (totalPages <= 1) return null

  return (
    <div className={`flex items-center justify-center gap-3 ${className ?? ''}`}>
      <Button
        size="icon-sm"
        variant="outline"
        aria-label="Vorherige Seite"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      <p className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>
        Seite {page} von {totalPages}
      </p>
      <Button
        size="icon-sm"
        variant="outline"
        aria-label="Nächste Seite"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
