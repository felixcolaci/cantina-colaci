import { redirect } from 'next/navigation'

// '/app' is the only real entry point left in the active tree -- this
// covers the authenticated case that proxy.ts's cookie-gate lets through
// without redirecting (it only redirects unauthenticated requests).
export default function RootPage() {
  redirect('/app')
}
