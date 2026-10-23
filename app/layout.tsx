import type { Metadata } from 'next'
import { Fraunces, Figtree, DM_Mono } from 'next/font/google'
import './globals.css'

const displayFont = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

const bodyFont = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-body',
  display: 'swap',
})

const monoFont = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Vino Mio',
  description: 'Il tuo cellar di famiglia',
  manifest: '/manifest.json',
  icons: {
    apple: '/apple-touch-icon.png',
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Vino Mio',
  },
}

// Keeps the `dark` class (Tailwind's class-based dark variant, see
// app/globals.css's `@custom-variant dark`) in sync with the user's
// theme_preference before the browser's first paint -- runs synchronously
// during HTML parsing, ahead of React hydration. Mirrors the same
// localStorage key and system-preference fallback that lib/theme/
// theme-provider.tsx uses once it mounts, per the inline-script pattern in
// node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
// ("Themes"). 'light'/'dark' apply directly; anything else (missing,
// 'system') falls back to prefers-color-scheme.
const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem('theme-preference');var r=(p==='light'||p==='dark')?p:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.toggle('dark',r==='dark')}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="de"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
