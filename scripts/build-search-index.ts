// CLI entrypoint — wywoływany przez `tsx scripts/build-search-index.ts` z predev + prebuild.
// Czyta content/posts/<slug>/index.mdx, ekstraktuje SearchEntry per post, zapisuje
// public/search-index.json. Generated file jest gitignored (regenerated each build).
import { promises as fs } from 'fs'
import path from 'path'
import { buildSearchIndex } from '../lib/search'

async function main() {
  const entries = await buildSearchIndex()
  const outPath = path.join(process.cwd(), 'public', 'search-index.json')
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, JSON.stringify(entries, null, 0), 'utf8')
  // console.error per CLAUDE.md hard rule #5 (stderr, nie zaśmieca stdout pipelines).
  console.error(`[search-index] wrote ${entries.length} entries → ${path.relative(process.cwd(), outPath)}`)
}

main().catch(err => {
  console.error('[search-index] failed:', err)
  process.exit(1)
})
