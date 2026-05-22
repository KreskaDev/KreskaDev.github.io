export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    // Usuwa combining diacritical marks (U+0300..U+036F) — PL → ASCII.
    // Explicit Unicode escapes (literal combining chars w source mogą być silent-mangled przez edytor).
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l') // ł nie ma combining decomposition, special case
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
