'use client'

import { Link, type LinkComponentProps } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

// Shared chrome-style back link for every subpage that isn't rendering over
// a photo hero (wine-detail-screen's floating pill stays bespoke). Centralizing
// this is the fix for subpages silently shipping without one -- trips-screen
// and history-screen both went out without any back navigation at all before
// this existed, each new screen having to remember the exact markup by eye.
export function BackLink({ to, params, children, className }: {
  to: LinkComponentProps['to']
  params?: LinkComponentProps['params']
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      params={params}
      className={`inline-flex items-center gap-0.5 text-sm font-medium ${className ?? ''}`}
      style={{ color: 'var(--muted-foreground)' }}
    >
      <ChevronLeft className="h-4 w-4 -ml-0.5" />
      {children}
    </Link>
  )
}
