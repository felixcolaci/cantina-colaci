'use client'

import { useSwUpdate } from '@/lib/hooks/use-sw-update'

export function SwUpdateBanner() {
  const { updateReady, applyUpdate } = useSwUpdate()
  if (!updateReady) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px 10px 16px',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-sm)',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'blur(12px)',
        background: 'color-mix(in oklab, var(--foreground) 90%, transparent)',
        color: 'var(--background)',
      }}
    >
      <span style={{ opacity: 0.8 }}>Neue Version verfügbar</span>
      <button
        onClick={applyUpdate}
        style={{
          padding: '4px 12px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--background)',
          color: 'var(--foreground)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
          lineHeight: 1.4,
        }}
      >
        Jetzt laden
      </button>
    </div>
  )
}
