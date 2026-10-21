'use client'

import { createContext, useContext, useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router'
import { WifiOff, RefreshCw, Check } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { usePowerSync, useStatus } from '@powersync/react'
import type { AbstractPowerSyncDatabase, SyncStatus } from '@powersync/web'
import { createClient } from '@/lib/supabase/client'
import { apiGet, apiMutate, ApiError } from '@/lib/spa/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { CellarScreen } from '@/app/app/cellar-screen'
import { WineDetailScreen } from '@/app/app/wine-detail-screen'
import { StorageLocationsScreen } from '@/app/app/storage-locations-screen'
import { TripsScreen } from '@/app/app/trips-screen'
import { DiscoveriesScreen } from '@/app/app/discoveries-screen'
import { TripDetailScreen } from '@/app/app/trip-detail-screen'
import { HistoryScreen } from '@/app/app/history-screen'
import { FamilyScreen } from '@/app/app/family-screen'
import { CellarSettingsScreen } from '@/app/app/cellar-settings-screen'
import { ApiKeysScreen } from '@/app/app/api-keys-screen'

type Me = {
  userId: string
  email: string | null
  familyId: string | null
  cellarId: string | null
}

// Local SQLite persists per browser profile (IndexedDB), independent of the
// Supabase session. On a shared device, the next person to log in must never
// see this user's rows -- disconnectAndClear() wipes every synced table;
// PowerSync repopulates it from scratch, scoped to whichever user logs in
// next (via a fresh JWT -> auth.user_id() -> fresh sync-config.yaml query).
// The Service Worker's photo-cache (sw.ts) is origin-scoped, not
// user-scoped, so it needs the same treatment -- otherwise the next person
// to log in on this device could still load an old cached photo by hitting
// the same /api/v1/photos/[...path] URL (unlikely to collide across
// families, but cheap to rule out).
async function logout(db: AbstractPowerSyncDatabase) {
  await db.disconnectAndClear()
  await createClient().auth.signOut()
  await caches.delete('photo-cache').catch(() => {})
}

// Every route below the root needs to know which cellar it's reading from.
// RootShell resolves it once (gated behind session + sync + onboarding) and
// hands it down via context instead of threading it through route params.
const CellarIdContext = createContext<string | null>(null)
export function useCellarId() {
  const cellarId = useContext(CellarIdContext)
  if (!cellarId) throw new Error('useCellarId() called outside a route with a resolved cellar')
  return cellarId
}

// Same rationale as CellarIdContext -- discoveries.created_by needs the
// caller's own user id at insert time (AddDiscoverySheet), not threaded
// through route params.
const UserIdContext = createContext<string | null>(null)
export function useUserId() {
  const userId = useContext(UserIdContext)
  if (!userId) throw new Error('useUserId() called outside a route with a resolved user')
  return userId
}

function RootShell() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  // Hook must run unconditionally regardless of which branch below renders.
  const status = useStatus()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!sessionLoaded) return null
  if (!session) return <LoginCard />
  // hasSynced is undefined while the local DB is still opening, false until
  // the first full sync checkpoint lands, then stays true for good (it
  // persists locally -- a returning, already-synced user skips this screen
  // entirely and goes straight to MeShell, even offline).
  if (!status.hasSynced) return <SyncScreen status={status} />
  return <MeShell />
}

// Ring variant of SyncIndicator below: PowerSync's own realtime
// downloadProgress.downloadedFraction (0..1) drawn as an SVG arc instead of
// a flat pulsing dot, so an actual long sync (not just the first-ever one,
// which SyncScreen already bars/numbers) visibly advances instead of just
// blinking the same way the whole time. currentColor so the caller's text-*
// class controls the arc's color.
function SyncProgressRing({ fraction }: { fraction: number }) {
  const size = 14
  const strokeWidth = 2
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(1, Math.max(0, fraction)))

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 150ms linear' }}
      />
    </svg>
  )
}

// Continuous background-sync indicator for screens past the initial sync
// gate (SyncScreen). hasSynced is already true here, so this only ever
// reflects ongoing activity -- not whether the app is usable yet. Icon-only
// by design (no word label beside it) -- the accessible/hover text still
// lives in the title attribute via status.getMessage().
function SyncIndicator({ status }: { status: SyncStatus }) {
  const title = status.getMessage()
  const progress = status.downloadProgress

  if (!status.connected) {
    return (
      <span title={title} className="flex text-muted-foreground">
        <WifiOff className="h-3.5 w-3.5" />
      </span>
    )
  }
  // downloadProgress is only ever set while downloading is true, but a
  // download can be in-flight for a moment before that first progress
  // report lands -- fall through to the plain spinner for that gap instead
  // of rendering a ring stuck at 0%.
  if (status.downloading && progress) {
    return (
      <span title={title} className="flex text-amber-500">
        <SyncProgressRing fraction={progress.downloadedFraction} />
      </span>
    )
  }
  if (status.downloading || status.uploading) {
    return (
      <span title={title} className="flex text-amber-500">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      </span>
    )
  }
  return (
    <span title={title} className="flex text-emerald-500">
      <Check className="h-3.5 w-3.5" />
    </span>
  )
}

function SyncScreen({ status }: { status: SyncStatus }) {
  const db = usePowerSync()
  const progress = status.downloadProgress
  const error = status.downloadError ?? status.uploadError

  return (
    <Card className="max-w-sm mx-auto mt-16">
      <CardHeader>
        <CardTitle>{error ? 'Synchronisierung fehlgeschlagen' : 'Erstmalige Synchronisierung…'}</CardTitle>
        <CardDescription>
          {error ? 'Bitte Internetverbindung prüfen' : 'Daten werden für die Offline-Nutzung geladen'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {error ? (
          <p className="text-destructive">{error.message}</p>
        ) : progress ? (
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${Math.round(progress.downloadedFraction * 100)}%` }}
              />
            </div>
            <p className="text-muted-foreground">
              {progress.downloadedOperations} / {progress.totalOperations}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">Verbinde…</p>
        )}
        <button
          onClick={() => logout(db)}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Abmelden
        </button>
      </CardContent>
    </Card>
  )
}

function LoginCard() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setPending(false)
    if (error) setError('E-Mail oder Passwort falsch')
  }

  return (
    <Card className="max-w-sm mx-auto mt-16">
      <CardHeader>
        <CardTitle>Anmelden</CardTitle>
        <CardDescription>Vino Mio — neue App-Oberfläche (Vorschau)</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={pending} className="w-full">Anmelden</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}

function MeShell() {
  const { data, isLoading, error } = useQuery<Me>({
    queryKey: ['me'],
    queryFn: () => apiGet<Me>('/me'),
  })
  const status = useStatus()
  const db = usePowerSync()

  if (data && !data.familyId) return <OnboardingCard />

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <SyncIndicator status={status} />
        <button
          onClick={() => logout(db)}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Abmelden
        </button>
      </div>
      {isLoading && <p className="px-4 text-sm text-muted-foreground">Lade…</p>}
      {error && <p className="px-4 text-sm text-destructive">{(error as Error).message}</p>}
      {data?.cellarId && (
        <CellarIdContext.Provider value={data.cellarId}>
          <UserIdContext.Provider value={data.userId}>
            <Outlet />
          </UserIdContext.Provider>
        </CellarIdContext.Provider>
      )}
    </div>
  )
}

// Shown once a brand-new user's first PowerSync checkpoint lands empty
// (no family_members row yet) -- mirrors the legacy /onboarding page, but as
// a card within the SPA shell instead of a separate route. On success,
// invalidating ['me'] re-fetches and MeShell swaps itself to the connected
// view; no PowerSync reconnect needed since the self-hosted sync rules
// recompute bucket membership from the family_members write itself.
function OnboardingCard() {
  const queryClient = useQueryClient()
  const [familyName, setFamilyName] = useState('')
  const [cellarName, setCellarName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await apiMutate('POST', '/onboarding', { familyName, cellarName })
      await queryClient.invalidateQueries({ queryKey: ['me'] })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Anlegen fehlgeschlagen')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="max-w-sm mx-auto mt-16">
      <CardHeader>
        <CardTitle>Willkommen bei Vino Mio</CardTitle>
        <CardDescription>
          Leg deine Familie und deinen ersten Weinkeller an, um loszulegen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="familyName">Familienname</Label>
            <Input
              id="familyName"
              value={familyName}
              onChange={e => setFamilyName(e.target.value)}
              placeholder="Colaci"
              maxLength={60}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cellarName">Name deines Kellers</Label>
            <Input
              id="cellarName"
              value={cellarName}
              onChange={e => setCellarName(e.target.value)}
              placeholder="Weinkeller"
              maxLength={60}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={pending} className="w-full">
            {pending ? 'Wird angelegt…' : 'Keller anlegen'}
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}

function CellarScreenRoute() {
  const cellarId = useCellarId()
  return <CellarScreen cellarId={cellarId} />
}

function WineDetailRoute() {
  const { id } = wineDetailRoute.useParams()
  const cellarId = useCellarId()
  return <WineDetailScreen wineId={id} cellarId={cellarId} />
}

function StorageLocationsRoute() {
  const cellarId = useCellarId()
  return <StorageLocationsScreen cellarId={cellarId} />
}

function TripsRoute() {
  const cellarId = useCellarId()
  return <TripsScreen cellarId={cellarId} />
}

function TripDetailRoute() {
  const { id } = tripDetailRoute.useParams()
  return <TripDetailScreen tripId={id} />
}

function DiscoveriesRoute() {
  const cellarId = useCellarId()
  const userId = useUserId()
  return <DiscoveriesScreen cellarId={cellarId} userId={userId} />
}

function HistoryRoute() {
  const cellarId = useCellarId()
  return <HistoryScreen cellarId={cellarId} />
}

function FamilyRoute() {
  return <FamilyScreen />
}

function CellarSettingsRoute() {
  const cellarId = useCellarId()
  return <CellarSettingsScreen cellarId={cellarId} />
}

function ApiKeysRoute() {
  return <ApiKeysScreen />
}

const rootRoute = createRootRoute({ component: RootShell })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: CellarScreenRoute,
})

const wineDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wine/$id',
  component: WineDetailRoute,
})

const storageLocationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/locations',
  component: StorageLocationsRoute,
})

const tripsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trips',
  component: TripsRoute,
})

const tripDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trips/$id',
  component: TripDetailRoute,
})

const discoveriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/discoveries',
  component: DiscoveriesRoute,
})

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/history',
  component: HistoryRoute,
})

const familyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/family',
  component: FamilyRoute,
})

const cellarSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/cellar',
  component: CellarSettingsRoute,
})

const apiKeysRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/api-keys',
  component: ApiKeysRoute,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  wineDetailRoute,
  storageLocationsRoute,
  tripsRoute,
  tripDetailRoute,
  discoveriesRoute,
  historyRoute,
  familyRoute,
  cellarSettingsRoute,
  apiKeysRoute,
])

const router = createRouter({ routeTree, basepath: '/app' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function SpaRouter() {
  return <RouterProvider router={router} />
}
