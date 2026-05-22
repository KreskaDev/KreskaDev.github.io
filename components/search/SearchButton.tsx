'use client'
import { Search } from 'lucide-react'

export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open search"
      className="w-9 h-9 inline-flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition"
    >
      <Search size={18} aria-hidden />
    </button>
  )
}
