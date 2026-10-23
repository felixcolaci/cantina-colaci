type AppLoadingScreenProps = {
  label?: string
  pastDelay?: boolean
}

// Branded full-screen loader shown across every phase of first load: the
// next/dynamic chunk fetch for the SPA shell (app/app/[[...slug]]/page.tsx)
// and the session check before PowerSync's sync status is known
// (lib/spa/router.tsx's RootShell). `pastDelay` mirrors the prop
// next/dynamic's loadable.shared-runtime passes to a custom `loading`
// component (200ms default delay) so a warm/cached load doesn't flash this
// before swapping straight to real content.
export function AppLoadingScreen({ label, pastDelay = true }: AppLoadingScreenProps) {
  if (!pastDelay) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background">
      <svg viewBox="0 0 32 32" className="h-12 w-12" aria-hidden="true">
        <defs>
          <clipPath id="app-loading-glass-clip">
            <path d="M5 8 Q7.5 20 14.5 22 L14.5 26 L12 26 L12 28 L20 28 L20 26 L17.5 26 L17.5 22 Q24.5 20 27 8 Z" />
          </clipPath>
        </defs>
        <path
          d="M5 8 Q7.5 20 14.5 22 L14.5 26 L12 26 L12 28 L20 28 L20 26 L17.5 26 L17.5 22 Q24.5 20 27 8 Z"
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth="1"
          opacity="0.5"
        />
        <g clipPath="url(#app-loading-glass-clip)">
          <rect x="0" y="8" width="32" height="24" fill="var(--primary)" className="app-loading-glass-fill" />
        </g>
      </svg>
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
      <span className="sr-only">Wird geladen…</span>
    </div>
  )
}
