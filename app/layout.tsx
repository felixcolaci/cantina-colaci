import type { Metadata } from 'next'
import { Cormorant_Garamond, Mulish } from 'next/font/google'
import './globals.css'
import { TopBar } from '@/components/nav/top-bar'
import { BottomNav } from '@/components/nav/bottom-nav'
import { createClient } from '@/lib/supabase/server'

const displayFont = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

const bodyFont = Mulish({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-body',
  display: 'swap',
})

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
    <html lang="de" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        {user && <TopBar />}
        <main className={user ? 'pt-14 pb-16 min-h-screen' : 'min-h-screen'}>
          {children}
        </main>
        {user && <BottomNav />}
      </body>
    </html>
  )
}
