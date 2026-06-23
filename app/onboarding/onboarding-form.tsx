'use client'

import { createFamilyAndCellar } from '@/lib/actions/family'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function OnboardingForm() {
  const { run, isPending, error } = useServerAction(createFamilyAndCellar)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deinen Keller anlegen</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="familyName">Familienname</Label>
            <Input id="familyName" name="familyName" placeholder="Colaci" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cellarName">Keller-Name</Label>
            <Input id="cellarName" name="cellarName" placeholder="Hauptkeller" required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Keller anlegen</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
