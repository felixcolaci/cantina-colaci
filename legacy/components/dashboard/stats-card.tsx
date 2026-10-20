import Link from 'next/link'

interface StatsCardProps {
  title: string
  value: string | number
  href?: string
}

const cardStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-sm)',
  padding: 'var(--space-4) var(--space-5)',
  display: 'block',
  textDecoration: 'none',
  color: 'inherit',
  transition: 'box-shadow var(--duration-fast) var(--ease-standard)',
} as const

export function StatsCard({ title, value, href }: StatsCardProps) {
  const content = (
    <>
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
    </>
  )

  if (href) {
    return (
      <Link href={href} className="wine-card-hover" style={cardStyle}>
        {content}
      </Link>
    )
  }

  return <div style={cardStyle}>{content}</div>
}
