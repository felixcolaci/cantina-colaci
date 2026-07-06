'use client'

import { createFamilyAndCellar } from '@/lib/actions/onboarding'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function OnboardingForm() {
  const { run, isPending, error } = useServerAction(createFamilyAndCellar)

  return (
    <form
      onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="familyName">Familienname</Label>
        <Input id="familyName" name="familyName" placeholder="Colaci" required maxLength={60} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cellarName">Name deines Kellers</Label>
        <Input id="cellarName" name="cellarName" placeholder="Weinkeller" required maxLength={60} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Wird angelegt…' : 'Keller anlegen'}
      </Button>
    </form>
  )
}
