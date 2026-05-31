'use client'
import { forwardRef } from 'react'

interface Props {
  value: string
  onChange: (next: string) => void
}

export const SearchInput = forwardRef<HTMLInputElement, Props>(function SearchInput(
  { value, onChange },
  ref,
) {
  return (
    <input
      ref={ref}
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Search posts..."
      aria-label="Search posts"
      className="flex-1 bg-transparent border-b border-border focus:border-accent outline-none py-2 text-text-primary placeholder:text-text-tertiary font-sans"
    />
  )
})
