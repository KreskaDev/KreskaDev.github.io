import type { MetadataRoute } from 'next'

// Next 16 + output:'export' wymaga jawnego dynamic config dla metadata routes.
export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://kreskadev.github.io/sitemap.xml',
  }
}
