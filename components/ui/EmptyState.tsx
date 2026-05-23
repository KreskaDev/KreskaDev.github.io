import Link from 'next/link'

interface EmptyStateProps {
  message: string
  cta?: { label: string; href: string }
}

export function EmptyState({ message, cta }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <p className="text-text-secondary font-sans text-lg mb-4">{message}</p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-block px-4 py-2 text-burgundy underline underline-offset-4 hover:opacity-80 transition font-sans"
        >
          {cta.label}
        </Link>
      )}
    </div>
  )
}
