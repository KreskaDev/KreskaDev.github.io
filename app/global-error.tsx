'use client'

import { useEffect } from 'react'

// RootLayout jest replaced gdy ten boundary handluje błąd — musimy mieć własne <html> + <body>.
export default function GlobalError({
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
    <html lang="en">
      <body>
        <div style={{ padding: '4rem 1.5rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h1>Application error</h1>
          <p>A critical error occurred. Refresh the page or try again.</p>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  )
}
