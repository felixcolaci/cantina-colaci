import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogoutButton } from './logout-button'

export async function TopBar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
      style={{
        height: '3.5rem',
        background: 'color-mix(in oklab, var(--card) 88%, transparent)',
        backdropFilter: 'saturate(140%) blur(12px)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 4px 16px rgba(61,38,22,0.06)',
      }}
    >
      <Link
        href="/"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-xl)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-tight)',
          lineHeight: 1,
          color: 'var(--foreground)',
          textDecoration: 'none',
        }}
      >
        Vino Mio
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger render={
          <button className="cursor-pointer rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </button>
        } />
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href="/family" />}>
            Familie
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/settings/locations" />}>
            Lagerorte
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/settings/api-keys" />}>
            API-Schlüssel
          </DropdownMenuItem>
          <LogoutButton />
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
