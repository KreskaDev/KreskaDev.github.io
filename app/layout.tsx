import type { Metadata } from 'next'
import { Instrument_Serif, Geist, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Footer } from '@/components/layout/Footer'
import { TopNav } from '@/components/layout/TopNav'
import 'katex/dist/katex.min.css'
import './globals.css'

const instrumentSerif = Instrument_Serif({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  variable: '--font-instrument-serif',
  display: 'swap',
})

const geist = Geist({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-geist',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const baseUrl = 'https://kreskadev.github.io'

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'What is the truth?',
    template: '%s — What is the truth?',
  },
  description:
    'Essays on probability, reasoning, and the gap between what we measure and what we know.',
  // ADR-027: static assets w public/ + manualne metadata wpisy (NIE app/icon.tsx / app/opengraph-image.tsx — broken na GH Pages pod output:'export').
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'What is the truth?',
    description:
      'Essays on probability, reasoning, and the gap between what we measure and what we know.',
    url: baseUrl,
    siteName: 'What is the truth?',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'What is the truth?' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', images: ['/og-image.png'] },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${geist.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <div className="flex flex-col min-h-screen">
            <TopNav />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
