import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/posts'

// Next 16 + output:'export' wymaga jawnego dynamic config dla metadata routes.
export const dynamic = 'force-static'

const baseUrl = 'https://kreskadev.github.io'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts()
  const postEntries: MetadataRoute.Sitemap = posts.map(p => ({
    url: `${baseUrl}/posts/${p.slug}/`,
    lastModified: p.date,
    changeFrequency: 'yearly',
    priority: 0.8,
  }))
  return [
    { url: `${baseUrl}/`, changeFrequency: 'monthly', priority: 1.0 },
    { url: `${baseUrl}/blog/`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/about/`, changeFrequency: 'yearly', priority: 0.5 },
    ...postEntries,
  ]
}
