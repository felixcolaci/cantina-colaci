'use client'

type RatingInputProps = {
  name: string
  value: number | null
  onChange: (v: number) => void
}

export function RatingInput({ name, value, onChange }: RatingInputProps) {
  return (
    <div>
      <input type="hidden" name={name} value={value ?? ''} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {[1, 2, 3, 4, 5].map(n => {
          const selected = value === n
          return (
            <button
              key={n}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(n)}
              style={{
                height: 52,
                borderRadius: 'var(--radius-md)',
                border: selected ? 'none' : '1px solid var(--border)',
                background: selected ? 'var(--primary)' : 'var(--parchment)',
                color: selected ? 'white' : 'var(--ink-700)',
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                cursor: 'pointer',
                transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)`,
              }}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}
