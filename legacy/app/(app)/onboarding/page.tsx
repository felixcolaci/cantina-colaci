import { getCellarContext } from '@/lib/cellar-context'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './onboarding-form'

export default async function OnboardingPage() {
  const context = await getCellarContext()
  if (context?.cellarId) redirect('/')

  return (
    <div className="px-4 py-12 max-w-sm mx-auto space-y-6">
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 600,
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--foreground)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Willkommen bei Vino Mio
        </h1>
        <p style={{ color: 'var(--muted-foreground)' }}>
          Leg deine Familie und deinen ersten Weinkeller an, um loszulegen.
        </p>
      </div>
      <OnboardingForm />
    </div>
  )
}
