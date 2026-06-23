interface StatsCardProps {
  title: string
  value: string | number
}

export function StatsCard({ title, value }: StatsCardProps) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-4) var(--space-5)',
      }}
    >
      <p className="eyebrow mb-2">{title}</p>
      <p
        className="nums"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 700,
          lineHeight: 1,
          color: 'var(--foreground)',
        }}
      >
        {value}
      </p>
    </div>
  )
}
