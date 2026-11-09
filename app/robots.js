import { SITE_URL } from '@/lib/seo'

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/dashboard', '/cart', '/checkout', '/login', '/register', '/forgot', '/reset', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}