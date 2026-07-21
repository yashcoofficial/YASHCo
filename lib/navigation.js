const DEFAULT_NAV_ITEMS = [
  { id: 'shop', label: 'Shop', footerLabel: 'All Pieces', pageKey: 'shop', collectionSlug: null, route: '/shop', visible: true },
  { id: 'menswear', label: 'Men', footerLabel: 'Menswear', pageKey: 'shop', collectionSlug: 'menswear', route: '/shop/menswear', visible: true },
  { id: 'womenswear', label: 'Women', footerLabel: 'Womenswear', pageKey: 'shop', collectionSlug: 'womenswear', route: '/shop/womenswear', visible: true },
  { id: 'accessories', label: 'Accessories', footerLabel: 'Accessories', pageKey: 'shop', collectionSlug: 'accessories', route: '/shop/accessories', visible: true },
  { id: 'concierge', label: 'Concierge', footerLabel: 'Concierge', pageKey: 'concierge', collectionSlug: null, route: '/concierge', visible: true },
]

function buildRouteForItem(item = {}) {
  const pageKey = item.pageKey || item.page || 'shop'
  const collectionSlug = item.collectionSlug ?? item.collection ?? null

  if (pageKey === 'concierge') return '/concierge'
  if (pageKey === 'shop' && collectionSlug) return `/shop/${collectionSlug}`
  if (pageKey === 'shop') return '/shop'
  return '/'
}

function buildRouteForView(name, params = {}) {
  switch (name) {
    case 'shop':
      return params.collection ? `/shop/${params.collection}` : '/shop'
    case 'product':
      return params.id ? `/product/${params.id}` : '/'
    case 'cart':
      return '/cart'
    case 'checkout':
      return '/checkout'
    case 'login':
      return '/login'
    case 'register':
      return '/register'
    case 'forgot':
      return '/forgot'
    case 'reset':
      return '/reset'
    case 'concierge':
      return '/concierge'
    case 'about':
      return '/about'
    default:
      return '/'
  }
}

function resolveViewFromPath(pathname = '/', searchParams = {}) {
  const params = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams)
  const normalizedPath = pathname || '/'

  if (normalizedPath.startsWith('/product/')) {
    const id = normalizedPath.split('/product/')[1]
    return { name: 'product', params: { id } }
  }

  if (normalizedPath.startsWith('/products/')) {
    const id = normalizedPath.split('/products/')[1]
    return { name: 'product', params: { id } }
  }

  if (normalizedPath === '/shop' || normalizedPath.startsWith('/shop/')) {
    const collection = normalizedPath.startsWith('/shop/') ? normalizedPath.replace('/shop/', '').split('/')[0] : ''
    return { name: 'shop', params: collection ? { collection } : {} }
  }

  if (normalizedPath === '/concierge') return { name: 'concierge', params: {} }
  if (normalizedPath === '/cart') return { name: 'cart', params: {} }
  if (normalizedPath === '/checkout') return { name: 'checkout', params: {} }
  if (normalizedPath === '/login') return { name: 'login', params: {} }
  if (normalizedPath === '/register') return { name: 'register', params: {} }
  if (normalizedPath === '/forgot') return { name: 'forgot', params: {} }
  if (normalizedPath === '/reset') return { name: 'reset', params: {} }
  if (normalizedPath === '/about') return { name: 'about', params: {} }

  return { name: 'home', params: {} }
}

function normalizeNavItems(items = [], collections = []) {
  const safeItems = Array.isArray(items) ? items : []
  const fallback = DEFAULT_NAV_ITEMS.map((item) => ({ ...item }))
  const source = safeItems.length ? safeItems : fallback

  return source.map((item) => {
    const pageKey = item?.pageKey || item?.page || 'shop'
    const collectionSlug = item?.collectionSlug ?? item?.collection ?? null
    const route = buildRouteForItem({ pageKey, collectionSlug })
    const normalized = {
      id: item?.id || item?.label?.toLowerCase().replace(/\s+/g, '-') || 'nav-link',
      label: item?.label || 'Link',
      footerLabel: item?.footerLabel || item?.label || 'Link',
      page: pageKey,
      pageKey,
      collection: collectionSlug || '',
      collectionSlug,
      route,
      visible: item?.visible !== false,
    }

    return normalized
  }).filter((item) => item.visible !== false).filter((item) => !item.collectionSlug || collections.some((collection) => collection?.slug === item.collectionSlug))
}

function getVisibleNavItems(items = [], collections = []) {
  return normalizeNavItems(items, collections)
}

function getBoutiqueNavItems(items = [], collections = []) {
  return getVisibleNavItems(items, collections).filter((item) => item.pageKey === 'shop')
}

export {
  DEFAULT_NAV_ITEMS,
  buildRouteForItem,
  buildRouteForView,
  resolveViewFromPath,
  normalizeNavItems,
  getVisibleNavItems,
  getBoutiqueNavItems,
}
