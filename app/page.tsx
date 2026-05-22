import Link from 'next/link'

export default function Home() {
  return (
    <main className="container mx-auto max-w-2xl px-6 py-24">
      <h1 className="font-display text-5xl text-text-primary mb-4">What is the truth?</h1>
      <p className="text-text-secondary">
        Scaffold ready. Home content pending Prompt 03.{' '}
        <Link href="/posts/example/" className="text-burgundy underline">
          View example post
        </Link>
        .
      </p>
    </main>
  )
}
