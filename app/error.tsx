'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="container mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="font-display text-4xl text-text-primary mb-4">Something went wrong</h1>
      <p className="text-text-secondary mb-8">
        An unexpected error occurred. The error has been logged.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-burgundy text-bg-primary rounded font-sans"
      >
        Try again
      </button>
    </div>
  )
}
