import { getAuthenticatedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TopBar } from '@/components/nav/top-bar'
import { BottomNav } from '@/components/nav/bottom-nav'
import { OfflineToast } from '@/components/ui/offline-toast'
import { SwUpdateBanner } from '@/components/ui/sw-update-banner'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')

  return (
    <>
      <TopBar />
      <main className="pt-14 pb-16 min-h-screen">{children}</main>
      <BottomNav />
      <OfflineToast />
      <SwUpdateBanner />
    </>
  )
}
