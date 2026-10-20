'use client'

import { useOfflineSync } from '@/lib/hooks/use-offline-sync'

export function OfflineToast() {
  const { isOnline, isSyncing, lastSyncResult } = useOfflineSync()

  const showOffline = !isOnline
  const showSyncing = isOnline && isSyncing
  const showSuccess = isOnline && !isSyncing && lastSyncResult && lastSyncResult.synced > 0

  if (!showOffline && !showSyncing && !showSuccess) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 80, // above bottom nav
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-sm)',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'blur(12px)',
        ...(showOffline
          ? {
              background: 'color-mix(in oklab, var(--foreground) 85%, transparent)',
              color: 'var(--background)',
            }
          : showSuccess
          ? {
              background: 'color-mix(in oklab, var(--success, #16a34a) 90%, transparent)',
              color: '#fff',
            }
          : {
              background: 'color-mix(in oklab, var(--foreground) 85%, transparent)',
              color: 'var(--background)',
            }),
      }}
    >
      {showOffline && (
        <>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', flexShrink: 0 }} />
          Offline — Änderungen werden gespeichert
        </>
      )}
      {showSyncing && (
        <>
          <span
            style={{
              width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: 'white', borderRadius: '50%',
              animation: 'spin 0.7s linear infinite', flexShrink: 0,
            }}
          />
          Synchronisiere…
        </>
      )}
      {showSuccess && lastSyncResult && (
        <>
          <span style={{ fontSize: 16 }}>✓</span>
          {lastSyncResult.synced === 1
            ? '1 Eintrag synchronisiert'
            : `${lastSyncResult.synced} Einträge synchronisiert`}
          {lastSyncResult.failed > 0 && ` · ${lastSyncResult.failed} fehlgeschlagen`}
        </>
      )}
    </div>
  )
}
