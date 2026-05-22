import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="container mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="font-display text-6xl text-text-primary mb-4">404</h1>
      <p className="text-xl text-text-secondary mb-8">This page doesn&apos;t exist (yet?).</p>
      <div className="flex justify-center gap-4">
        <Link
          href="/"
          className="px-4 py-2 bg-burgundy text-bg-primary rounded hover:opacity-90 transition font-sans"
        >
          Home
        </Link>
        <Link
          href="/blog/"
          className="px-4 py-2 border border-burgundy text-burgundy rounded hover:bg-burgundy hover:text-bg-primary transition font-sans"
        >
          Browse posts
        </Link>
      </div>
    </div>
  )
}
