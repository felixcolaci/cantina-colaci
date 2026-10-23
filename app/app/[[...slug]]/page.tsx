'use client'

import dynamic from 'next/dynamic'
import { AppLoadingScreen } from '@/components/app-loading-screen'

// Next.js's only job under /app is to serve this one client shell -- every
// path below /app (the list, /app/wine/$id, …) is matched client-side by
// TanStack Router (see lib/spa/router.tsx), not by Next's file router. This
// optional catch-all just has to exist so Next doesn't 404 on those paths
// before the client router ever gets a chance to render.
//
// `ssr: false` is load-bearing, not an optimization: TanStack Router's
// RouterProvider reads from a real browser History object on first render
// (resolving the current location to match routes), which doesn't exist
// during Next's one Node-side render pass -- even for a 'use client' page.
// Without this, that pass throws ("Cannot read properties of undefined
// (reading 'matches')") before the client ever gets a chance to hydrate.
const SpaRouter = dynamic(() => import('@/lib/spa/router').then(m => m.SpaRouter), {
  ssr: false,
  // Covers the "assets loading" phase: the SPA bundle itself hasn't downloaded
  // yet. pastDelay comes from next/dynamic's loadable.shared-runtime (see
  // node_modules/next/dist/shared/lib/loadable.shared-runtime.js) and only
  // flips true after its 200ms default delay, so a warm/cached load never
  // flashes this.
  loading: ({ pastDelay }) => <AppLoadingScreen pastDelay={pastDelay} />,
})

export default function SpaShellPage() {
  return <SpaRouter />
}
