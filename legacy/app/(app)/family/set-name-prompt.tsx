'use client'

import { setDisplayName } from '@/lib/actions/family'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SetNamePrompt({ emailPrefix }: { emailPrefix: string }) {
  return (
    <div
      style={{
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        background: 'color-mix(in oklab, var(--primary) 6%, var(--background))',
        border: '1px solid color-mix(in oklab, var(--primary) 20%, transparent)',
        marginBottom: 'var(--space-6)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          color: 'var(--foreground)',
          fontWeight: 500,
          marginBottom: 'var(--space-3)',
        }}
      >
        Wie möchtest du heißen?
      </p>
      <form action={setDisplayName} style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Input
          name="display_name"
          defaultValue={emailPrefix}
          maxLength={40}
          style={{ flex: 1 }}
        />
        <Button type="submit">Speichern</Button>
      </form>
    </div>
  )
}
