'use client'

import { createContext, useContext, useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router'
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
async function logout(db: AbstractPowerSyncDatabase) {
  await db.disconnectAndClear()
  await createClient().auth.signOut()
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

// Continuous background-sync indicator for screens past the initial sync
// gate (SyncScreen). hasSynced is already true here, so this only ever
// reflects ongoing activity -- not whether the app is usable yet.
function SyncIndicator({ status }: { status: SyncStatus }) {
  const label = !status.connected
    ? 'Offline'
    : status.downloading || status.uploading
      ? 'Synchronisiert…'
      : 'Synchron'
  const dotClass = !status.connected
    ? 'bg-muted-foreground'
    : status.downloading || status.uploading
      ? 'bg-amber-500 animate-pulse'
      : 'bg-emerald-500'

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title={status.getMessage()}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
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
          <Outlet />
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
  return <WineDetailScreen wineId={id} />
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

const routeTree = rootRoute.addChildren([indexRoute, wineDetailRoute])

const router = createRouter({ routeTree, basepath: '/app' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function SpaRouter() {
  return <RouterProvider router={router} />
}
