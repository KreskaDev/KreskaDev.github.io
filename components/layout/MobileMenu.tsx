'use client'
import { useEffect, useRef, type RefObject } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

interface MobileMenuLink {
  href: string
  label: string
}

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  triggerRef: RefObject<HTMLButtonElement | null>
  links: ReadonlyArray<MobileMenuLink>
  pathname: string
}

// Native <dialog> drawer slide-in z prawej krawędzi (ADR-036). Focus trap +
// ESC dismiss + backdrop click — native browser behavior; CSS animation +
// reduced-motion guard żyją w globals.css `.mobile-menu-dialog` rules.
// Focus return na trigger po close = manualny `triggerRef.current?.focus()`
// w cleanup effect (native <dialog> NIE provides focus return).
export function MobileMenu({ isOpen, onClose, triggerRef, links, pathname }: MobileMenuProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen) dialog.showModal()
    else dialog.close()
  }, [isOpen])

  // Body scroll lock + focus return na trigger po close (parity z SearchModal pattern).
  // `triggerRef` żyje w parent TopNav (stable mount); cleanup czyta `.current` w setTimeout
  // przy fire time (świadomie świeża wartość, NIE captured snapshot) — eslint warn ignored.
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      // setTimeout(0) — daje cleanup-cycle czas zanim focus race z dialog.close().
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setTimeout(() => triggerRef.current?.focus(), 0)
    }
  }, [isOpen, triggerRef])

  return (
    <dialog
      ref={dialogRef}
      id="mobile-menu-dialog"
      onClose={onClose}
      onClick={e => {
        if (e.target === dialogRef.current) onClose()
      }}
      aria-label="Main menu"
      className="mobile-menu-dialog"
    >
      <div className="flex flex-col h-full w-full max-w-xs ml-auto bg-bg-primary border-l border-border">
        <div className="flex items-center justify-end h-16 px-4 border-b border-border">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="w-11 h-11 inline-flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition"
          >
            <X size={22} aria-hidden />
          </button>
        </div>
        <nav className="flex flex-col p-4 gap-2 font-sans">
          {links.map(link => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={[
                  'min-h-12 flex items-center px-3 rounded text-base',
                  active
                    ? 'text-burgundy bg-burgundy-soft/30 font-medium'
                    : 'text-text-primary hover:bg-surface-elevated',
                ].join(' ')}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </dialog>
  )
}
