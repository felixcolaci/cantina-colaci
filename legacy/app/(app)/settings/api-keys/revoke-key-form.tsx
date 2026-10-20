'use client'

import { revokeApiKey } from '@/lib/actions/api-keys'
import { Button } from '@/components/ui/button'

export function RevokeKeyForm({ id, name }: { id: string; name: string }) {
  return (
    <form action={revokeApiKey}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
      >
        Widerrufen
      </Button>
    </form>
  )
}
