'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Shared by CellarSettingsScreen (own-row highlighting,
// app/app/cellar-settings-screen.tsx) and ThemeProvider (own
// theme_preference lookup, lib/theme/theme-provider.tsx) -- both need the
// signed-in user's id to find their own family_members row via
// useOwnFamilyMember.
export function useCurrentUserId() {
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null))
  }, [])
  return userId
}
