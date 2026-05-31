import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="container mx-auto max-w-2xl px-4 sm:px-6 py-16 sm:py-24 text-center">
      <h1 className="font-display text-5xl sm:text-6xl text-text-primary mb-4">404</h1>
      <p className="text-lg sm:text-xl text-text-secondary mb-8">This page doesn&apos;t exist (yet?).</p>
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-center">
        <Link
          href="/"
          prefetch={false}
          className="px-4 py-2 bg-accent text-bg-primary rounded hover:opacity-90 transition font-sans"
        >
          Home
        </Link>
        <Link
          href="/blog/"
          prefetch={false}
          className="px-4 py-2 border border-accent text-accent rounded hover:bg-accent hover:text-bg-primary transition font-sans"
        >
          Browse posts
        </Link>
      </div>
    </div>
  )
}
