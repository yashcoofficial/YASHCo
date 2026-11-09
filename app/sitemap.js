import { SITE_URL } from '@/lib/seo'

const publicRoutes = [
  { path: '/', priority: 1 },
  { path: '/shop', priority: 0.9 },
  { path: '/shop/menswear', priority: 0.8 },
  { path: '/shop/womenswear', priority: 0.8 },
  { path: '/shop/accessories', priority: 0.7 },
  { path: '/perfume', priority: 0.7 },
  { path: '/concierge', priority: 0.6 },
  { path: '/about', priority: 0.5 },
]

export default function sitemap() {
  return publicRoutes.map(({ path, priority }) => ({
    url: new URL(path, SITE_URL).toString(),
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority,
  }))
}