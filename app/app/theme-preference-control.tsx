'use client'

import { useTheme } from '@/lib/theme/theme-provider'
import { THEME_PREFERENCES, type ThemePreference } from '@/lib/theme/types'

const LABELS: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Hell',
  dark: 'Dunkel',
}

// Segmented light/dark/system picker for the settings screen's
// "Darstellung" section (app/app/cellar-settings-screen.tsx) -- writes
// through useTheme()'s local-first PowerSync UPDATE
// (lib/theme/theme-provider.tsx), same pattern as EditNameSheet's direct
// `db.execute` for display_name.
export function ThemePreferenceControl() {
  const { preference, setPreference } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Erscheinungsbild"
      className="inline-flex rounded-lg p-1 gap-1"
      style={{ background: 'var(--muted)' }}
    >
      {THEME_PREFERENCES.map(value => {
        const active = value === preference
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(value)}
            className="px-3 py-1.5 rounded-md text-sm transition-colors"
            style={{
              background: active ? 'var(--background)' : 'transparent',
              color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
              fontWeight: active ? 600 : 500,
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {LABELS[value]}
          </button>
        )
      })}
    </div>
  )
}
