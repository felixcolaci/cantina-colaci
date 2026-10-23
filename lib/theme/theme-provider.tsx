'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { usePowerSync } from '@powersync/react'
import { useCurrentUserId } from '@/lib/auth/use-current-user-id'
import { useOwnFamilyMember } from '@/lib/powersync/queries'
import { isThemePreference, type ThemePreference } from '@/lib/theme/types'

const STORAGE_KEY = 'theme-preference'

type ResolvedTheme = 'light' | 'dark'

type ThemeContextValue = {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isThemePreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function writeStoredPreference(preference: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Safari private mode etc. -- the in-memory preference still applies
    // for this page load, it just won't survive a refresh.
  }
}

// Mirrors the inline script in app/layout.tsx (same localStorage key, same
// system-preference fallback) so the very first paint already matches what
// this provider settles into -- see
// node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
// ("Themes") for why that split exists.
//
// Three sources feed `preference`, in order of who "wins": the inline
// script's localStorage read (fastest, pre-hydration), then this provider's
// own state, then -- once it loads -- the user's family_members.theme_preference
// row via PowerSync, which is the one durable source of truth and lets a
// preference set on one device reach the others.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const db = usePowerSync()
  const userId = useCurrentUserId()
  const { id: memberId, themePreference: dbPreference, isLoading } = useOwnFamilyMember(userId ?? '')

  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)

  // Tracks which synced value this provider has already adopted, so the
  // adjustment below only fires once per actual change to the DB row, not
  // on every render while still loading. DB wins once the user's own row
  // has synced down -- picks up a preference set on another device
  // instead of staying stuck on whatever this browser's localStorage last
  // cached.
  const [adoptedDbPreference, setAdoptedDbPreference] = useState<ThemePreference | null>(null)

  // Adjusting state during render (React's documented pattern for "derive
  // state from a prop/external value, but let it still be locally
  // overridden") rather than in an effect: an effect would apply the
  // synced value one paint late, after this render has already committed
  // the stale one.
  if (!isLoading && memberId && dbPreference !== adoptedDbPreference) {
    setAdoptedDbPreference(dbPreference)
    if (dbPreference !== preference) {
      setPreferenceState(dbPreference)
      writeStoredPreference(dbPreference)
    }
  }

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemTheme(media.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme: ResolvedTheme = preference === 'system' ? systemTheme : preference

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  function setPreference(next: ThemePreference) {
    setPreferenceState(next)
    writeStoredPreference(next)
    if (memberId) {
      void db.execute(`UPDATE family_members SET theme_preference = ? WHERE id = ?`, [next, memberId])
    }
  }

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
