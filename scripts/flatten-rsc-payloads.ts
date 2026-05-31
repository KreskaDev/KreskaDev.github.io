/**
 * Postbuild workaround dla vercel/next.js#85374.
 *
 * Next 16.2.6 z `output: 'export'` zapisuje RSC payload pliki w dir-encoded
 * strukturze (`out/<route>/__next.<seg>/__PAGE__.txt`), ale client runtime
 * fetch-uje dot-encoded URL-e (`/about/__next.about.__PAGE__.txt?_rsc=…`).
 * Mismatch → 404 na każdym hard nav i page-load segment fetch.
 *
 * Workaround: znajdź każdy `__next.*` katalog w `out/`, walk recursively,
 * dla każdego leaf `.txt` file emit copy z dot-joined ścieżką jako sibling
 * obok parent's `__next.<seg>` dir. Oryginalna struktura katalogowa zostaje
 * (defensive — niektóre tools / proxy mogą używać slash variant).
 *
 * Cleanup criteria (ADR-046): gdy vercel/next.js#86948 zmerguje i upgrade'ujemy
 * do wersji z fix-em upstream, usuń ten skrypt + postbuild hook + supersede ADR.
 *
 * Tracking: https://github.com/vercel/next.js/issues/85374
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve(process.cwd(), 'out')

async function findNextDirs(root: string): Promise<string[]> {
  const result: string[] = []
  async function walk(dir: string) {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const full = path.join(dir, entry.name)
      if (entry.name.startsWith('__next.')) {
        result.push(full)
      } else {
        await walk(full)
      }
    }
  }
  await walk(root)
  return result
}

async function collectLeafFiles(
  base: string,
  current = base,
): Promise<{ absPath: string; relativeSegments: string[] }[]> {
  const out: { absPath: string; relativeSegments: string[] }[] = []
  const entries = await fs.readdir(current, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(current, entry.name)
    if (entry.isDirectory()) {
      const nested = await collectLeafFiles(base, full)
      out.push(...nested)
    } else if (entry.isFile()) {
      const rel = path.relative(base, full)
      const segments = rel.split(path.sep)
      out.push({ absPath: full, relativeSegments: segments })
    }
  }
  return out
}

async function ensureCopy(src: string, dest: string): Promise<boolean> {
  try {
    await fs.access(dest)
    return false
  } catch {
    // not exists
  }
  await fs.copyFile(src, dest)
  return true
}

async function main() {
  const nextDirs = await findNextDirs(OUT_DIR)
  let createdCount = 0
  let skippedCount = 0

  for (const dir of nextDirs) {
    const parent = path.dirname(dir)
    const prefix = path.basename(dir) // e.g. "__next.about"
    const leaves = await collectLeafFiles(dir)
    for (const leaf of leaves) {
      // np. relativeSegments = ['$d$slug', '__PAGE__.txt']
      // chcemy "__next.posts" + ".$d$slug.__PAGE__.txt"
      // → "__next.posts.$d$slug.__PAGE__.txt"
      const flatName = `${prefix}.${leaf.relativeSegments.join('.')}`
      const flatPath = path.join(parent, flatName)
      const created = await ensureCopy(leaf.absPath, flatPath)
      if (created) createdCount++
      else skippedCount++
    }
  }

  console.error(
    `[flatten-rsc-payloads] copied ${createdCount} file(s) (${skippedCount} already existed). ` +
      `${nextDirs.length} __next.* dir(s) processed.`,
  )
}

main().catch(err => {
  console.error('[flatten-rsc-payloads] FAILED:', err)
  process.exit(1)
})
