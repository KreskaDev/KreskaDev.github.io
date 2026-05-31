import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MobileMenu } from '@/components/layout/MobileMenu'

// jsdom NIE implementuje HTMLDialogElement.showModal/close — polyfill manual
// (parity z SearchModal.test.tsx).
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/blog/', label: 'Blog' },
  { href: '/about/', label: 'About' },
] as const

function renderMenu(isOpen: boolean, onClose = vi.fn(), pathname = '/blog/') {
  const triggerRef = createRef<HTMLButtonElement>()
  // Trigger element musi istnieć w DOM żeby focus return po close nie no-op'ował.
  const trigger = document.createElement('button')
  document.body.appendChild(trigger)
  Object.defineProperty(triggerRef, 'current', { value: trigger, writable: true })
  const utils = render(
    <MobileMenu
      isOpen={isOpen}
      onClose={onClose}
      triggerRef={triggerRef}
      links={LINKS}
      pathname={pathname}
    />,
  )
  return { ...utils, onClose, trigger }
}

describe('MobileMenu', () => {
  it('dialog jest closed gdy isOpen=false', () => {
    const { container } = renderMenu(false)
    const dialog = container.querySelector('dialog')
    expect(dialog).not.toHaveAttribute('open')
  })

  it('renderuje 3 nav linki gdy isOpen=true', () => {
    renderMenu(true)
    const dialog = screen.getByRole('dialog', { name: 'Main menu' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Blog' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'About' })).toBeInTheDocument()
  })

  it('klik nav linka woła onClose', async () => {
    const user = userEvent.setup()
    const { onClose } = renderMenu(true)
    await user.click(screen.getByRole('link', { name: 'Home' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('klik close (X) buttona woła onClose', async () => {
    const user = userEvent.setup()
    const { onClose } = renderMenu(true)
    await user.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('aria-current="page" na linku matchującym pathname', () => {
    renderMenu(true, vi.fn(), '/blog/')
    const blogLink = screen.getByRole('link', { name: 'Blog' })
    expect(blogLink).toHaveAttribute('aria-current', 'page')
    const homeLink = screen.getByRole('link', { name: 'Home' })
    expect(homeLink).not.toHaveAttribute('aria-current')
  })
})
