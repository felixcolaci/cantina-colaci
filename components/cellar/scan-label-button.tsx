'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { scanWineLabel } from '@/lib/actions/scan-label'
import type { ScanResult } from '@/lib/actions/scan-label'
import { compressImage } from '@/lib/image-compress'

export function ScanLabelButton({ onResult }: { onResult: (r: ScanResult) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    startTransition(async () => {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.set('image', compressed)
      const result = await scanWineLabel(fd)
      if (result.error) {
        setError(result.error)
      } else {
        onResult(result)
      }
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%',
          gap: 6,
          borderStyle: 'dashed',
          color: 'var(--muted-foreground)',
        }}
      >
        {isPending
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Etikett wird gelesen…</>
          : <><Camera className="h-4 w-4" /> Etikett scannen</>
        }
      </Button>
      {error && (
        <p style={{ color: 'var(--destructive)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
          {error}
        </p>
      )}
    </div>
  )
}
