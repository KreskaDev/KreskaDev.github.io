'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { SearchButton } from '@/components/search/SearchButton'
import { SearchModal } from '@/components/search/SearchModal'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export function TopNav() {
  const [hasShadow, setHasShadow] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    // rAF throttling — bez tego scroll jank na long pages.
    let scheduled = false
    const onScroll = () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(() => {
        setHasShadow(window.scrollY > 0)
        scheduled = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    // Initial sync — strona załadowana w środku scrolla (deep-link).
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { href: '/', label: 'Home' },
    { href: '/blog/', label: 'Blog' },
    { href: '/about/', label: 'About' },
  ] as const

  return (
    <>
      <header
        className={[
          'sticky top-0 z-50 h-16 bg-bg-primary/80 backdrop-blur-md',
          'transition-[border-color] duration-200',
          hasShadow ? 'border-b border-border' : 'border-b border-transparent',
        ].join(' ')}
      >
        <nav className="container mx-auto h-full max-w-5xl px-6 flex items-center justify-between">
          <Link href="/" className="font-display text-lg text-text-primary">
            What is the truth?
          </Link>
          <ul className="flex items-center gap-6 font-sans text-sm">
            {links.map(link => {
              const active = pathname === link.href
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'text-burgundy underline underline-offset-4'
                        : 'text-text-secondary hover:text-text-primary'
                    }
                  >
                    {link.label}
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className="flex items-center gap-2">
            <SearchButton onClick={() => setSearchOpen(true)} />
            <ThemeToggle />
          </div>
        </nav>
      </header>
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
