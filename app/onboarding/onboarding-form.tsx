'use client'

import { createFamilyAndCellar } from '@/lib/actions/family'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function OnboardingForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Crea la tua cantina</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createFamilyAndCellar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="familyName">Nome della famiglia</Label>
            <Input id="familyName" name="familyName" placeholder="Colaci" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cellarName">Nome della cantina</Label>
            <Input id="cellarName" name="cellarName" placeholder="Cantina principale" required />
          </div>
          <Button type="submit" className="w-full">Crea cantina</Button>
        </form>
      </CardContent>
    </Card>
  )
}
