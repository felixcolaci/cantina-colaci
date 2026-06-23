'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
  },
  {
    href: '/cellar',
    label: 'Keller',
    icon: (
      <>
        <path d="M8 22h8" />
        <path d="M7 10h10" />
        <path d="M12 15v7" />
        <path d="M7 2h10l-1.2 8.5a4 4 0 0 1-7.6 0L7 2Z" />
      </>
    ),
  },
  {
    href: '/trips',
    label: 'Reisen',
    icon: (
      <>
        <path d="M12 2a7 7 0 0 1 7 7c0 4.5-7 13-7 13S5 13.5 5 9a7 7 0 0 1 7-7Z" />
        <circle cx="12" cy="9" r="2.5" />
      </>
    ),
  },
  {
    href: '/history',
    label: 'Geschichte',
    icon: (
      <>
        <path d="M12 8v13" />
        <path d="M8 21h8" />
        <path d="M5 3h14l-1 4.5a6 6 0 0 1-12 0L5 3Z" />
      </>
    ),
  },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around"
      style={{
        background: 'color-mix(in oklab, var(--card) 88%, transparent)',
        backdropFilter: 'saturate(140%) blur(12px)',
        borderTop: '1px solid var(--border)',
        boxShadow: 'var(--shadow-nav-top)',
        padding: '8px 10px',
        paddingBottom: 'calc(8px + var(--safe-bottom))',
      }}
    >
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className="flex flex-col items-center justify-center gap-1 flex-1 py-1"
            style={{
              color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
              transition: `color var(--duration-fast) var(--ease-standard)`,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg
              width="22" height="22" viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth={isActive ? 2.3 : 1.9}
              strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
            >
              {icon}
            </svg>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.6875rem',
                fontWeight: isActive ? 800 : 600,
                letterSpacing: '0.02em',
              }}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
