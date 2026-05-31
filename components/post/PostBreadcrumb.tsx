import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface PostBreadcrumbProps {
  parentSlug: string
  parentTitle: string
}

export function PostBreadcrumb({ parentSlug, parentTitle }: PostBreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb" className="mb-8">
      <Link
        href={`/posts/${parentSlug}/`}
        className="inline-flex items-center gap-1 text-text-secondary hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded transition-colors font-sans text-sm"
      >
        <ChevronLeft size={16} aria-hidden />
        <span>{parentTitle}</span>
      </Link>
    </nav>
  )
}
