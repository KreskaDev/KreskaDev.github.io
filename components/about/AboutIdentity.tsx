import Image from 'next/image'

// Brand icon SVG paths (simple-icons project, CC0). Inline zamiast lucide-react,
// bo wersja 1.16.0 nie zawiera brand icons (zostały usunięte z lucide-react upstream).
const GITHUB_PATH =
  'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'
const LINKEDIN_PATH =
  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'
const MAIL_PATH =
  'M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z'

function BrandIcon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  )
}

interface AboutIdentityProps {
  photo: string
  city: string
  country: string
  lat: string
  lng: string
  github: string
  linkedin: string
  email: string
}

// Sticky sidebar "identity card" — foto + lokalizacja + mapa + icon strip.
// Stack na <md (mobile), sidebar od lg. Sticky żeby przy długim prose
// kontekst osoby zostawał w viewport.
export function AboutIdentity({
  photo,
  city,
  country,
  lat,
  lng,
  github,
  linkedin,
  email,
}: AboutIdentityProps) {
  // Format coords w stylu engineer geocoord (np. "53.13°N, 23.16°E"). N/S wg znaku.
  // Lat/lng przekazywane jako stringi z MDX — JSX expression `{53.13}` w MDX 3 + RSC
  // czasem nie propaguje się jako numeryk przez kompilator next-mdx-remote, stringi +
  // parseFloat są niezawodne i czytelne dla autora MDX.
  const latNum = parseFloat(lat)
  const lngNum = parseFloat(lng)
  const formattedCoords = `${Math.abs(latNum).toFixed(2)}°${latNum >= 0 ? 'N' : 'S'}, ${Math.abs(lngNum).toFixed(2)}°${lngNum >= 0 ? 'E' : 'W'}`

  return (
    <aside className="not-prose w-full lg:w-[280px] lg:shrink-0 lg:sticky lg:top-24 lg:self-start flex flex-col gap-4 sm:gap-6 items-center lg:items-stretch">
      <div className="relative aspect-square w-40 sm:w-56 lg:w-full overflow-hidden rounded-lg border border-border">
        <Image
          src={photo}
          alt="Rafał Krasowski"
          fill
          sizes="(min-width: 1024px) 280px, (min-width: 640px) 224px, 160px"
          className="object-cover"
          priority
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-display text-lg text-text-primary">
          {city}, {country}
        </span>
        <span className="font-mono text-xs text-text-tertiary tracking-wide">
          {formattedCoords}
        </span>
      </div>

      <ul className="flex flex-col gap-2 list-none p-0 m-0">
        <li>
          <a
            href={github}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 py-2 -my-2 text-text-secondary hover:text-burgundy transition font-sans text-sm"
          >
            <BrandIcon d={GITHUB_PATH} />
            <span>github.com/{github.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '')}</span>
          </a>
        </li>
        <li>
          <a
            href={linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 py-2 -my-2 text-text-secondary hover:text-burgundy transition font-sans text-sm"
          >
            <BrandIcon d={LINKEDIN_PATH} />
            <span>LinkedIn</span>
          </a>
        </li>
        <li>
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-3 py-2 -my-2 text-text-secondary hover:text-burgundy transition font-sans text-sm"
          >
            <BrandIcon d={MAIL_PATH} />
            <span>{email}</span>
          </a>
        </li>
      </ul>
    </aside>
  )
}
