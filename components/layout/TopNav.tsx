'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SearchButton } from '@/components/search/SearchButton'
import { SearchModal } from '@/components/search/SearchModal'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { PaletteToggle } from '@/components/ui/PaletteToggle'
import { MobileMenu } from '@/components/layout/MobileMenu'

export function TopNav() {
  const [hasShadow, setHasShadow] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
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
        <nav className="container mx-auto h-full max-w-5xl px-4 sm:px-6 flex items-center justify-between gap-3">
          <Link href="/" className="font-display text-base sm:text-lg text-text-primary truncate">
            What is the truth?
          </Link>
          <ul className="hidden md:flex items-center gap-6 font-sans text-sm">
            {links.map(link => {
              const active = pathname === link.href
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'text-accent underline underline-offset-4'
                        : 'text-text-secondary hover:text-text-primary'
                    }
                  >
                    {link.label}
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className="flex items-center gap-1 sm:gap-2">
            <SearchButton onClick={() => setSearchOpen(true)} />
            <ThemeToggle />
            {/* PaletteToggle hidden mobile per plan v5-10 R22 LOCKED (4-icon row overflow ≥360px).
                Mobile users dostają drawer entry w MobileMenu (Krok 15). */}
            <PaletteToggle className="hidden md:inline-flex" />
            {/* Mobile hamburger — md:hidden ukrywa na desktop gdzie inline linki przejmują. */}
            <button
              ref={triggerRef}
              type="button"
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu-dialog"
              onClick={() => setMenuOpen(true)}
              className="md:hidden w-11 h-11 inline-flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition"
            >
              <Menu size={22} aria-hidden />
            </button>
          </div>
        </nav>
      </header>
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <MobileMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        triggerRef={triggerRef}
        links={links}
        pathname={pathname}
      />
    </>
  )
}
