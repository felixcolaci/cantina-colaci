import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TopBar } from '@/components/nav/top-bar'
import { BottomNav } from '@/components/nav/bottom-nav'
import { createClient } from '@/lib/supabase/server'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'La Cantina Colaci',
  description: 'Eure Weinsammlung',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Cantina',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="de">
      <body className={inter.className}>
        {user && <TopBar />}
        <main className={user ? 'pt-14 pb-16 min-h-screen' : 'min-h-screen'}>
          {children}
        </main>
        {user && <BottomNav />}
      </body>
    </html>
  )
}
