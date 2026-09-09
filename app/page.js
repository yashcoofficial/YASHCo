'use client'
import { useEffect, useMemo, useState, useCallback, createContext, useContext } from 'react'
import { Toaster, toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  ShoppingBag, Heart, User, Search, Menu, X, ChevronRight, ChevronLeft, ChevronDown, Plus, Minus,
  Trash2, LogOut, Edit3, Package, Mail, MessageCircle, Settings as SettingsIcon,
  Truck, Star, Filter, Check, ArrowRight, Instagram, Facebook, Twitter,
  GripVertical, Eye, EyeOff, Download, ZoomIn,
} from 'lucide-react'
import { buildRouteForView, getBoutiqueNavItems, getVisibleNavItems, resolveViewFromPath } from '@/lib/navigation'
import { validateCheckoutForm } from '@/lib/checkout-utils.mjs'
import { getStockStatusText } from '@/lib/stock-utils'

// ---------- Context ----------
const AppCtx = createContext(null)
const useApp = () => useContext(AppCtx)

// ---------- Helpers ----------
const money = (n, sym = '₹') => `${sym}${(n || 0).toLocaleString('en-IN')}`
const cx = (...a) => a.filter(Boolean).join(' ')

async function downloadAdminExport(path, token) {
  const response = await fetch(`/api/admin/export/${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error('Export failed')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `yash-${path}.xls`
  anchor.click()
  URL.revokeObjectURL(url)
}

const DEFAULT_SOCIAL_LINKS = [
  { label: 'Instagram', url: 'https://www.instagram.com/', visible: true },
]

function normalizeSocialLinks(items) {
  const safeItems = Array.isArray(items) ? items : []
  return safeItems.length ? safeItems.map(link => ({
    label: link?.label || 'Social',
    url: link?.url || '',
    visible: link?.visible !== false,
  })) : DEFAULT_SOCIAL_LINKS
}

function socialIconFor(label = '') {
  const name = String(label).toLowerCase()
  if (name.includes('instagram')) return Instagram
  if (name.includes('facebook') || name.includes('meta')) return Facebook
  if (name.includes('twitter') || name.includes('x')) return Twitter
  return MessageCircle
}

// Map friendly colour names to CSS colours for swatch previews
function colorHex(name) {
  const map = {
    noir: '#0a0a0a', black: '#0a0a0a', jet: '#000000', ivory: '#f5efe6', white: '#ffffff', cream: '#f5efe6',
    champagne: '#dcc8a1', gold: '#c8a15b', beige: '#c9b898', sand: '#d9c7a2', camel: '#b48a5b',
    charcoal: '#333333', grey: '#808080', gray: '#808080', silver: '#c0c0c0',
    navy: '#1e2a44', midnight: '#1a1a2e', blue: '#3d5a80', teal: '#2a6f6b',
    emerald: '#046a38', forest: '#1e3d2f', olive: '#556b2f', sage: '#a3b18a',
    burgundy: '#800020', maroon: '#800000', red: '#b0202e', wine: '#7b1e2b', rose: '#c98b8b', blush: '#f2d3d0',
    pink: '#e8b4bc', mauve: '#a37f8f', lilac: '#c8a2c8', purple: '#6b3fa0', plum: '#5d3754',
    brown: '#5b3a1f', chocolate: '#3d2418', tan: '#b48a5b', mocha: '#4a2f1d',
    yellow: '#e5b83b', mustard: '#c99a2b', orange: '#c1622b',
  }
  const key = String(name || '').toLowerCase().trim()
  return map[key] || '#8b7b5a'
}

// ---------- Root ----------
export default function App() {
  const getInitialView = () => {
    if (typeof window === 'undefined') return { name: 'home', params: {} }
    return resolveViewFromPath(window.location.pathname, new URLSearchParams(window.location.search))
  }

  const [view, setView] = useState(getInitialView)
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [settings, setSettings] = useState(null)
  const [collections, setCollections] = useState([])
  const [cart, setCart] = useState([])
  const [wishlist, setWishlist] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [pendingCheckout, setPendingCheckout] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [transparentLogo, setTransparentLogo] = useState(null)
  const [allProducts, setAllProducts] = useState([])

  const api = useCallback(async (path, opts = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`/api${path}`, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }, [token])

  const updateUrlForView = useCallback((nextView, method = 'push') => {
    if (typeof window === 'undefined') return
    const target = buildRouteForView(nextView.name, nextView.params)
    const current = `${window.location.pathname}${window.location.search}`
    if (current !== target) {
      window.history[method === 'replace' ? 'replaceState' : 'pushState'](null, '', target)
    }
  }, [])

  const navigate = useCallback((name, params = {}) => {
    const nextView = { name, params }
    setView(nextView)
    setMenuOpen(false)
    setCartOpen(false)
    if (typeof window !== 'undefined') {
      updateUrlForView(nextView, 'push')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [updateUrlForView])

  // Load initial
  useEffect(() => {
    (async () => {
      try {
        const s = await api('/settings'); setSettings(s.settings)
        const c = await api('/collections'); setCollections(c.collections || [])
      } catch (e) { console.error(e) }
      const t = localStorage.getItem('yash_token')
      if (t) setToken(t)
      const cc = localStorage.getItem('yash_cart')
      if (cc) try { setCart(JSON.parse(cc)) } catch { }
    })()
  }, [])

  // Auth check when token set
  useEffect(() => {
    if (!token) { setUser(null); return }
    (async () => {
      try {
        const r = await api('/auth/me')
        if (r.user) setUser(r.user)
        else { setToken(null); localStorage.removeItem('yash_token') }
      } catch { setToken(null); localStorage.removeItem('yash_token') }
    })()
  }, [token, api])

  useEffect(() => { localStorage.setItem('yash_cart', JSON.stringify(cart)) }, [cart])

  // Fetch all products once (for dynamic filter facets)
  useEffect(() => {
    api('/products').then(r => setAllProducts(r.products || [])).catch(() => { })
  }, [api])

  // Process logo to remove white background (canvas-based transparent conversion)
  useEffect(() => {
    if (!settings?.logoUrl) return
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height)
        for (let i = 0; i < d.data.length; i += 4) {
          const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2]
          if (r > 225 && g > 225 && b > 225) d.data[i + 3] = 0
          else if (r > 200 && g > 200 && b > 200) d.data[i + 3] = Math.max(0, 255 - Math.round(((r + g + b) / 3 - 200) * 10))
        }
        ctx.putImageData(d, 0, 0)
        setTransparentLogo(canvas.toDataURL('image/png'))
      } catch (e) { /* CORS blocked, keep original with mix-blend */ }
    }
    img.src = settings.logoUrl
  }, [settings?.logoUrl])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const target = buildRouteForView(view.name, view.params)
    const current = `${window.location.pathname}${window.location.search}`
    if (current !== target) {
      window.history.replaceState(null, '', target)
    }
  }, [view.name, view.params])

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === 'undefined') return
      const nextView = resolveViewFromPath(window.location.pathname, new URLSearchParams(window.location.search))
      setView(nextView)
      setMenuOpen(false)
      setCartOpen(false)
    }

    const check = () => {
      if (typeof window === 'undefined') return
      const h = window.location.hash
      if (h === '#atelier' || h === '#admin' || h === '#admin-portal') {
        setView({ name: 'adminLogin', params: {} })
      }
    }

    check()
    window.addEventListener('hashchange', check)
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('hashchange', check)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const setAuth = (tok, u) => {
    if (tok) localStorage.setItem('yash_token', tok); else localStorage.removeItem('yash_token')
    setToken(tok || null); setUser(u || null)
    if (pendingCheckout && tok) {
      setPendingCheckout(false)
      setAuthModalOpen(false)
      navigate('checkout')
    }
  }

  const requestCheckoutAccess = useCallback(() => {
    if (!user) {
      setPendingCheckout(true)
      setAuthModalOpen(true)
      return
    }
    navigate('checkout')
  }, [navigate, user])

  const addToCart = (product, size, color, qty = 1) => {
    setCart(prev => {
      const key = `${product.id}|${size}|${color}`
      const i = prev.findIndex(x => x.key === key)
      if (i >= 0) { const copy = [...prev]; copy[i] = { ...copy[i], qty: copy[i].qty + qty }; return copy }
      return [...prev, { key, id: product.id, name: product.name, price: product.salePrice || product.price, shipping: Number(product.shipping) || 0, image: product.images?.[0], size, color, qty }]
    })
    toast.success('Added to bag')
  }
  const updateQty = (key, qty) => setCart(prev => prev.map(x => x.key === key ? { ...x, qty: Math.max(1, qty) } : x))
  const removeFromCart = (key) => setCart(prev => prev.filter(x => x.key !== key))
  const clearCart = () => setCart([])

  const toggleWishlist = async (productId) => {
    if (!user) { toast.error('Please sign in to save favourites'); navigate('login'); return }
    const isIn = wishlist.includes(productId)
    if (isIn) { await api(`/wishlist/${productId}`, { method: 'DELETE' }); setWishlist(w => w.filter(x => x !== productId)) }
    else { await api('/wishlist', { method: 'POST', body: { productId } }); setWishlist(w => [...w, productId]) }
  }
  useEffect(() => {
    if (!user) { setWishlist([]); return }
    api('/wishlist').then(r => setWishlist(r.productIds || [])).catch(() => { })
  }, [user, api])

  const ctxValue = { view, navigate, user, token, setAuth, settings, setSettings, collections, setCollections, cart, addToCart, updateQty, removeFromCart, clearCart, wishlist, toggleWishlist, api, cartOpen, setCartOpen, menuOpen, setMenuOpen, transparentLogo, allProducts, setAllProducts, authModalOpen, setAuthModalOpen, pendingCheckout, setPendingCheckout, requestCheckoutAccess, feedbackOpen, setFeedbackOpen }

  if (!settings) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader /></div>

  return (
    <AppCtx.Provider value={ctxValue}>
      <Toaster position="top-center" toastOptions={{ className: 'font-sans text-sm' }} />
      <AuthGateModal />
      <FeedbackDialog />
      <AnnouncementBar />
      <Header />
      <CartDrawer />
      <MobileMenu />
      <main className="min-h-[70vh]">
        {view.name === 'home' && <HomeView />}
        {view.name === 'shop' && <ShopView />}
        {view.name === 'product' && <ProductView />}
        {view.name === 'cart' && <CartView />}
        {view.name === 'checkout' && <CheckoutView />}
        {view.name === 'order-success' && <OrderSuccessView />}
        {view.name === 'login' && <LoginView />}
        {view.name === 'register' && <RegisterView />}
        {view.name === 'forgot' && <ForgotView />}
        {view.name === 'reset' && <ResetView />}
        {view.name === 'adminLogin' && <AdminLoginView />}
        {view.name === 'concierge' && <ConciergeView />}
        {view.name === 'dashboard' && <DashboardView />}
        {view.name === 'admin' && <AdminView />}
        {view.name === 'about' && <AboutView />}
      </main>
      <Footer />
    </AppCtx.Provider>
  )
}

function Loader() { return <div className="text-foreground/60 text-xs tracking-luxe uppercase">YASH</div> }

function AuthGateModal() {
  const { api, setAuth, navigate, authModalOpen, setAuthModalOpen, pendingCheckout, setPendingCheckout } = useApp()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      const r = await api('/auth/login', { method: 'POST', body: form })
      setAuth(r.token, r.user)
      toast.success(`Welcome, ${r.user.name}`)
      if (!pendingCheckout) {
        navigate(r.user.role === 'admin' ? 'admin' : 'dashboard')
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={authModalOpen} onOpenChange={(open) => { setAuthModalOpen(open); if (!open) setPendingCheckout(false) }}>
      <DialogContent className="rounded-none max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Sign in to continue</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <Input placeholder="Email" className="rounded-none h-12" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input type="password" placeholder="Password" className="rounded-none h-12" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <Button disabled={loading} className="w-full rounded-none h-12 tracking-editorial uppercase text-xs" onClick={submit}>{loading ? 'Signing in…' : 'Continue'}</Button>
          <div className="flex justify-between text-xs pt-2">
            <button className="underline" onClick={() => { setAuthModalOpen(false); setPendingCheckout(false); navigate('forgot') }}>Forgot password?</button>
            <button className="underline" onClick={() => { setAuthModalOpen(false); setPendingCheckout(false); navigate('register') }}>Create account</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FeedbackDialog() {
  const { api, user, feedbackOpen, setFeedbackOpen } = useApp()
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (feedbackOpen) setForm(prev => ({ ...prev, name: user?.name || prev.name, email: user?.email || prev.email }))
  }, [feedbackOpen, user])

  const submit = async (event) => {
    event.preventDefault()
    if (!form.name || !form.email || !form.message) {
      toast.error('Please share your name, email, and thoughts.')
      return
    }
    setSubmitting(true)
    try {
      await api('/feedback', { method: 'POST', body: form })
      toast.success('Thank you. Your perspective will help shape YASH.')
      setFeedbackOpen(false)
      setForm({ name: user?.name || '', email: user?.email || '', message: '' })
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
      <DialogContent className="rounded-none max-w-lg">
        <DialogHeader>
          <div className="text-[10px] tracking-luxe uppercase text-accent mb-2">A note to the house</div>
          <DialogTitle className="font-serif text-3xl">Your perspective matters.</DialogTitle>
          <p className="text-sm text-muted-foreground leading-relaxed pt-2">YASH is shaped with our community. Tell us what felt considered, what could feel better, or what you would love to see next. We read every note.</p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 mt-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input required placeholder="Your name" className="rounded-none h-12" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
            <Input required type="email" placeholder="Email address" className="rounded-none h-12" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
          </div>
          <Textarea required rows={5} placeholder="What would you like us to know?" className="rounded-none resize-none" value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} />
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="w-full rounded-none h-12 tracking-editorial uppercase text-xs">{submitting ? 'Sending…' : 'Share my feedback'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Header ----------
function AnnouncementBar() {
  const { settings } = useApp()
  if (!settings?.announcement) return null
  return (
    <div className="bg-primary text-primary-foreground text-[11px] tracking-editorial uppercase py-2.5 text-center px-4">
      {settings.announcement}
    </div>
  )
}

function Header() {
  const { navigate, user, cart, settings, setCartOpen, setMenuOpen, view, transparentLogo, collections } = useApp()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll); return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const cartCount = cart.reduce((s, x) => s + x.qty, 0)
  const transparent = view.name === 'home' && !scrolled
  const logoSrc = transparentLogo || settings.logoUrl
  const navLinks = getVisibleNavItems(settings?.headerNavLinks, collections)
  return (
    <header className={cx('sticky top-0 z-40 transition-all', transparent ? 'bg-transparent' : 'bg-background/90 backdrop-blur-md border-b border-border')}>
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-6 flex-1">
          <button className="md:hidden" onClick={() => setMenuOpen(true)}><Menu className={cx('w-5 h-5', transparent && 'text-white')} /></button>
          <nav className={cx('hidden md:flex items-center gap-8 text-[11px] tracking-editorial uppercase', transparent && 'text-white')}>
            {navLinks.map(link => {
              const categories = collections.filter(collection => collection.parentSlug === link.collectionSlug).sort((a, b) => (a.order || 0) - (b.order || 0))
              const hasCategories = link.page === 'shop' && categories.length > 0
              return (
                <div key={`${link.page}-${link.collection || 'main'}`} className={cx('relative group h-20 flex items-center', hasCategories && 'cursor-pointer')}>
                  <button onClick={() => navigate(link.page, link.collection ? { collection: link.collection } : {})} className="hover:text-accent transition-colors">{link.label}</button>
                  {hasCategories && <div className="absolute left-0 top-full z-50 min-w-48 border border-border bg-background p-2 normal-case opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 transition-all duration-150 shadow-sm">
                    {categories.map(category => <button key={category.id} onClick={() => navigate('shop', { collection: category.slug })} className="block w-full px-3 py-2 text-left text-[11px] tracking-editorial uppercase hover:bg-muted hover:text-accent transition-colors">{category.name}</button>)}
                  </div>}
                </div>
              )
            })}
          </nav>
        </div>
        <button onClick={() => navigate('home')} className="flex items-center justify-center">
          <img src={logoSrc} alt={settings.brand} className={cx('h-12 md:h-14 object-contain', !transparentLogo && 'mix-blend-multiply', transparent && 'brightness-0 invert')} />
        </button>
        <div className={cx('flex items-center gap-4 flex-1 justify-end', transparent ? 'text-white' : 'text-foreground')}>
          <button onClick={() => navigate('shop')} className="hidden md:block"><Search className="w-4 h-4" /></button>
          {user
            ? <button onClick={() => navigate(user.role === 'admin' ? 'admin' : 'dashboard')} className="text-[11px] tracking-editorial uppercase hidden md:flex items-center gap-2"><User className="w-4 h-4" /> {user.role === 'admin' ? 'Admin' : 'Account'}</button>
            : <button onClick={() => navigate('login')} className="text-[11px] tracking-editorial uppercase hidden md:flex items-center gap-2"><User className="w-4 h-4" />Sign In</button>
          }
          <button onClick={() => setCartOpen(true)} className="relative flex items-center gap-1">
            <ShoppingBag className="w-4 h-4" />
            {cartCount > 0 && <span className="text-[10px] tracking-editorial">({cartCount})</span>}
          </button>
        </div>
      </div>
    </header>
  )
}

function MobileMenu() {
  const { menuOpen, setMenuOpen, navigate, user, settings, collections } = useApp()
  const [expandedCollections, setExpandedCollections] = useState([])
  const navLinks = getVisibleNavItems(settings?.headerNavLinks, collections)

  useEffect(() => {
    if (!menuOpen) setExpandedCollections([])
  }, [menuOpen])

  return (
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      <SheetContent side="left" className="w-[85vw] sm:w-[380px] bg-background">
        <SheetHeader><SheetTitle className="font-serif text-2xl">Menu</SheetTitle></SheetHeader>
        <div className="mt-8 flex flex-col gap-5 text-sm tracking-editorial uppercase">
          {navLinks.map(link => {
            const categories = collections.filter(collection => collection.parentSlug === link.collectionSlug).sort((a, b) => (a.order || 0) - (b.order || 0))
            const hasCategories = link.page === 'shop' && categories.length > 0
            const isExpanded = expandedCollections.includes(link.collectionSlug)
            return (
              <div key={`${link.page}-${link.collection || 'main'}`} className="border-b border-border pb-3">
                {hasCategories
                  ? <button
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedCollections(current => isExpanded ? current.filter(slug => slug !== link.collectionSlug) : [...current, link.collectionSlug])}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <span>{link.label}</span>
                    <ChevronDown className={cx('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
                  </button>
                  : <button onClick={() => { setMenuOpen(false); navigate(link.page, link.collection ? { collection: link.collection } : {}) }} className="text-left">{link.label}</button>}
                {hasCategories && isExpanded && (
                  <div className="mt-3 ml-3 space-y-3 border-l border-border pl-4 normal-case">
                    <button onClick={() => { setMenuOpen(false); navigate('shop', { collection: link.collectionSlug }) }} className="block text-left text-xs text-accent uppercase">View all {link.label}</button>
                    {categories.map(category => <button key={category.id} onClick={() => { setMenuOpen(false); navigate('shop', { collection: category.slug }) }} className="block text-left text-xs text-muted-foreground">{category.name}</button>)}
                  </div>
                )}
              </div>
            )
          })}
          <button onClick={() => navigate(user ? (user.role === 'admin' ? 'admin' : 'dashboard') : 'login')} className="text-left border-b border-border pb-3">{user ? 'Account' : 'Sign In'}</button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CartDrawer() {
  const { cartOpen, setCartOpen, cart, updateQty, removeFromCart, navigate, settings, requestCheckoutAccess } = useApp()
  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0)
  const shipping = cart.reduce((sum, item) => sum + (Number(item.shipping) || 0) * item.qty, 0)
  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent side="right" className="w-[92vw] sm:w-[440px] bg-background flex flex-col">
        <SheetHeader><SheetTitle className="font-serif text-2xl">Your Bag</SheetTitle></SheetHeader>
        {cart.length === 0
          ? <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm">
            <ShoppingBag className="w-8 h-8 mb-4 opacity-40" />
            Your bag is empty
            <Button variant="outline" className="mt-6 rounded-none" onClick={() => { setCartOpen(false); navigate('shop') }}>Continue Shopping</Button>
          </div>
          : <>
            <div className="flex-1 overflow-y-auto py-6 space-y-6">
              {cart.map(item => (
                <div key={item.key} className="flex gap-4">
                  <img src={item.image} alt={item.name} className="w-20 h-28 object-cover" />
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">{item.color} · Size {item.size}</div>
                      </div>
                      <button onClick={() => removeFromCart(item.key)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" /></button>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center border border-border">
                        <button className="px-2 py-1" onClick={() => updateQty(item.key, item.qty - 1)}><Minus className="w-3 h-3" /></button>
                        <span className="px-3 text-xs">{item.qty}</span>
                        <button className="px-2 py-1" onClick={() => updateQty(item.key, item.qty + 1)}><Plus className="w-3 h-3" /></button>
                      </div>
                      <div className="text-sm">{money(item.price * item.qty, settings.currencySymbol)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-4 space-y-4">
              <div className="flex justify-between text-sm"><span className="tracking-editorial uppercase text-xs">Subtotal</span><span>{money(subtotal, settings.currencySymbol)}</span></div>
              <div className="flex justify-between text-sm"><span className="tracking-editorial uppercase text-xs">Shipping</span><span className={shipping === 0 ? 'text-accent tracking-editorial text-xs' : ''}>{shipping === 0 ? 'COMPLIMENTARY SHIPPING' : money(shipping, settings.currencySymbol)}</span></div>
              <div className="flex justify-between font-serif text-lg pt-3 border-t border-border"><span>Total</span><span>{money(subtotal + shipping, settings.currencySymbol)}</span></div>
              <Button className="w-full rounded-none h-12 tracking-editorial uppercase text-xs" onClick={() => { setCartOpen(false); requestCheckoutAccess() }}>Proceed to Checkout</Button>
            </div>
          </>}
      </SheetContent>
    </Sheet>
  )
}

// ---------- Home ----------
const DEFAULT_HOME_ORDER = ['hero', 'collections', 'featured', 'lookbook', 'about', 'concierge-cta', 'feedback']

function HomeView() {
  const { settings, collections, navigate, api, setFeedbackOpen } = useApp()
  const [featured, setFeatured] = useState([])
  useEffect(() => { api('/products?featured=true').then(r => setFeatured(r.products.slice(0, 4))).catch(() => { }) }, [api])

  // Style helpers
  const heroH = settings.heroHeight || '100vh'
  const heroAlign = settings.heroTextAlign || 'center'
  const heroVPos = settings.heroTextPosition || 'bottom'
  const heroOverlay = parseFloat(settings.heroOverlay ?? 0.4)
  const heroSize = settings.heroTitleSize || 'xl'
  const heroImageDesktop = settings.heroImageDesktop || settings.heroImage
  const heroImageMobile = settings.heroImageMobile || settings.heroImage
  const heroObjectPosition = settings.heroObjectPosition || 'center center'
  const collCols = settings.collectionsColumns || '3'
  const featCols = settings.featuredColumns || '4'
  const featBg = settings.featuredBg || 'muted'
  const lbStagger = settings.lookbookStagger !== 'false'
  const lbGap = settings.lookbookGap || 'sm'
  const aboutBg = settings.aboutBg || 'dark'
  const aboutPad = settings.aboutPadding || 'md'
  const conBg = settings.conciergeCtaBg || 'light'

  const savedSectionOrder = Array.isArray(settings.homeSectionOrder) ? settings.homeSectionOrder : DEFAULT_HOME_ORDER
  const sectionOrder = savedSectionOrder.includes('feedback') ? savedSectionOrder : [...savedSectionOrder, 'feedback']
  const vis = settings.homeSectionVisibility || {}
  const visibleCollectionLinks = getBoutiqueNavItems(settings?.headerNavLinks, collections).filter((item) => item.collectionSlug)
  const collectionItems = visibleCollectionLinks
    .map((link) => {
      const collection = collections.find((c) => c.slug === link.collectionSlug)
      return collection ? { ...collection, navLabel: link.label, navFooterLabel: link.footerLabel } : null
    })
    .filter((collection) => collection && !collection.parentSlug)

  const renderSection = (id) => {
    switch (id) {
      case 'hero': return (
        <section key="hero" className="hero-home-banner relative mt-0 sm:-mt-20 overflow-hidden" style={{ '--hero-height': heroH }}>
          <picture className="absolute inset-0 block h-full w-full">
            <source media="(max-width: 767px)" srcSet={heroImageMobile} />
            <source media="(min-width: 768px)" srcSet={heroImageDesktop} />
            <img src={heroImageDesktop} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: heroObjectPosition }} />
          </picture>
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, rgba(0,0,0,${heroOverlay * 0.8}), rgba(0,0,0,${heroOverlay * 0.3}), rgba(0,0,0,${heroOverlay * 1.2}))` }} />
          <div className={cx('hero-home-copy relative z-10 h-full flex max-w-full flex-col px-4 sm:px-6 slow-fade',
            heroAlign === 'center' && 'items-center text-center',
            heroAlign === 'left' && 'items-start text-left max-w-[1400px] mx-auto',
            heroAlign === 'right' && 'items-end text-right max-w-[1400px] mx-auto',
            heroVPos === 'bottom' && 'justify-end pb-12 sm:pb-24',
            heroVPos === 'center' && 'justify-center',
            heroVPos === 'top' && 'justify-start pt-20 sm:pt-32',
          )}>
            <div className="text-white/80 text-[11px] tracking-luxe uppercase mb-4 sm:mb-6">{settings.heroEyebrow || 'Season 01 — Nocturne'}</div>
            <h1 className={cx('hero-title font-serif text-white leading-[0.95] font-light max-w-full break-words',
              heroSize === 'xl' && 'text-4xl sm:text-6xl md:text-8xl lg:text-9xl',
              heroSize === 'lg' && 'text-4xl sm:text-5xl md:text-7xl lg:text-8xl',
              heroSize === 'md' && 'text-3xl sm:text-4xl md:text-6xl lg:text-7xl',
              heroSize === 'sm' && 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl',
            )}>{settings.heroTitle}</h1>
            <p className="hero-subtitle whitespace-pre-line text-white/85 mt-4 sm:mt-6 max-w-[min(100%,36rem)] text-sm md:text-base leading-relaxed">{settings.heroSubtitle}</p>
            <Button onClick={() => navigate('shop')} className="hero-cta mt-8 sm:mt-10 rounded-none bg-white text-black hover:bg-white/90 h-12 px-6 sm:px-10 tracking-editorial uppercase text-xs max-w-full whitespace-nowrap">{settings.heroCtaLabel || 'Discover the Collection'}</Button>
          </div>
        </section>
      )
      case 'collections':
        const collOverrides = (settings.collectionsImages || '').split('\n').map(x => x.trim()).filter(Boolean)
        if (!collectionItems.length) return null
        return (
          <section key="collections" className="max-w-[1400px] mx-auto px-4 md:px-8 py-24 md:py-32">
            <div className="text-center mb-16">
              <div className="text-[11px] tracking-luxe uppercase text-accent mb-4">{settings.collectionsEyebrow || 'Curated Collections'}</div>
              <h2 className="font-serif text-4xl md:text-5xl">{settings.collectionsTitle || 'A house, quietly assembled.'}</h2>
            </div>
            <div className={cx('grid gap-6 md:gap-10',
              collCols === '2' && 'md:grid-cols-2', collCols === '3' && 'md:grid-cols-3', collCols === '4' && 'md:grid-cols-4',
            )}>
              {collectionItems.map((c, i) => (
                <button key={c.id} onClick={() => navigate('shop', { collection: c.slug })} className="group text-left">
                  <div className="img-zoom overflow-hidden bg-muted" style={{ aspectRatio: settings.collectionsAspect || '3/4' }}><img src={collOverrides[i] || c.image} alt={c.name} className="w-full h-full object-cover" /></div>
                  <div className="mt-5 flex items-baseline justify-between">
                    <h3 className="font-serif text-2xl">{c.name}</h3>
                    <span className="text-[11px] tracking-editorial uppercase group-hover:text-accent transition-colors">Explore →</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{c.description}</p>
                </button>
              ))}
            </div>
          </section>
        )
      case 'featured':
        const featOverrides = (settings.featuredImages || '').split('\n').map(x => x.trim()).filter(Boolean)
        return (
          <section key="featured" className={cx('py-24 md:py-32',
            featBg === 'muted' && 'bg-muted/40', featBg === 'dark' && 'bg-primary text-primary-foreground', featBg === 'none' && '',
          )}>
            <div className="max-w-[1400px] mx-auto px-4 md:px-8">
              <div className="flex items-end justify-between mb-12">
                <div>
                  <div className="text-[11px] tracking-luxe uppercase text-accent mb-3">{settings.featuredEyebrow || 'The Edit'}</div>
                  <h2 className="font-serif text-4xl md:text-5xl">{settings.featuredTitle || 'Signature Pieces'}</h2>
                </div>
                <button onClick={() => navigate('shop')} className="text-[11px] tracking-editorial uppercase hover:text-accent">View All →</button>
              </div>
              <div className={cx('grid gap-4 md:gap-8',
                featCols === '2' && 'grid-cols-2', featCols === '3' && 'grid-cols-2 md:grid-cols-3', featCols === '4' && 'grid-cols-2 md:grid-cols-4',
              )}>
                {featured.map((p, i) => <ProductCard key={p.id} p={p} overrideImage={featOverrides[i]} aspectRatio={settings.featuredAspect || '3/4'} />)}
              </div>
            </div>
          </section>
        )
      case 'lookbook': return (
        <section key="lookbook" className="py-24 md:py-32 max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="text-center mb-16">
            <div className="text-[11px] tracking-luxe uppercase text-accent mb-4">{settings.lookbookSubtitle}</div>
            <h2 className="font-serif text-4xl md:text-5xl">{settings.lookbookTitle}</h2>
          </div>
          <div className={cx('grid md:grid-cols-3',
            lbGap === 'none' && 'gap-0', lbGap === 'sm' && 'gap-2 md:gap-4', lbGap === 'md' && 'gap-4 md:gap-8', lbGap === 'lg' && 'gap-6 md:gap-12',
          )}>
            {(settings.lookbookImages || []).map((img, i) => (
              <div key={i} className={cx('img-zoom', lbStagger && i === 1 ? 'md:mt-16' : '')}>
                <img src={img} alt="" className="w-full aspect-[3/4] object-cover" />
              </div>
            ))}
          </div>
        </section>
      )
      case 'about': return (
        <section key="about" className={cx(
          aboutBg === 'dark' ? 'bg-primary text-primary-foreground' : 'bg-muted/40',
          aboutPad === 'sm' && 'py-12 md:py-16', aboutPad === 'md' && 'py-24 md:py-32', aboutPad === 'lg' && 'py-32 md:py-44',
        )}>
          <div className="max-w-3xl mx-auto text-center px-6">
            <div className="text-[11px] tracking-luxe uppercase text-accent mb-6">{settings.aboutEyebrow || 'Maison'}</div>
            <h2 className="font-serif text-4xl md:text-5xl mb-8">{settings.aboutTitle}</h2>
            <div className="divider-gold mx-auto w-32 mb-8" />
            <p className={cx('whitespace-pre-line leading-relaxed', aboutBg === 'dark' ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{settings.aboutBody}</p>
          </div>
        </section>
      )
      case 'concierge-cta': return (
        <section key="concierge-cta" className={cx('py-24 max-w-3xl mx-auto text-center px-6', conBg === 'dark' && 'bg-primary text-primary-foreground')}>
          <div className="text-[11px] tracking-luxe uppercase text-accent mb-4">{settings.concierge?.title || 'Concierge'}</div>
          <h2 className="font-serif text-4xl md:text-5xl mb-4">{settings.conciergeHomeCta || 'Bespoke, on request.'}</h2>
          <p className={cx('whitespace-pre-line mb-8', conBg === 'dark' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{settings.concierge?.subtitle}</p>
          <Button onClick={() => navigate('concierge')} variant="outline" className={cx('rounded-none tracking-editorial uppercase text-xs h-12 px-10', conBg === 'dark' ? 'border-primary-foreground/30 text-primary-foreground' : 'border-primary')}>{settings.conciergeCtaLabel || 'Request a Consultation'}</Button>
        </section>
      )
      case 'feedback': return (
        <section key="feedback" className="border-t border-border py-20 md:py-28 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-[11px] tracking-luxe uppercase text-accent mb-4">{settings.feedbackEyebrow || 'Your voice, at the heart of the house'}</div>
            <h2 className="font-serif text-4xl md:text-5xl mb-5">{settings.feedbackTitle || 'Help us shape what comes next.'}</h2>
            <p className="whitespace-pre-line text-muted-foreground leading-relaxed mb-8">{settings.feedbackBody || 'Every thoughtful note helps us refine the YASH experience and create a brand that feels more meaningful to you.'}</p>
            <Button variant="outline" onClick={() => setFeedbackOpen(true)} className="rounded-none h-12 px-8 tracking-editorial uppercase text-xs">{settings.feedbackCtaLabel || 'Share your feedback'}</Button>
          </div>
        </section>
      )
      default: return null
    }
  }

  return (
    <div>
      {sectionOrder.map(id => vis[id] === false ? null : renderSection(id))}
    </div>
  )
}

function ProductCard({ p, overrideImage, aspectRatio }) {
  const { navigate, settings, toggleWishlist, wishlist } = useApp()
  const inWish = wishlist.includes(p.id)
  const stockStatusText = getStockStatusText(p)
  return (
    <div className="group cursor-pointer" onClick={() => navigate('product', { id: p.id })}>
      <div className="bg-muted relative overflow-hidden" style={{ aspectRatio: aspectRatio || '3/4' }}>
        <img src={overrideImage || p.images?.[0]} alt={p.name} className="w-full h-full object-cover" />
        <button onClick={(e) => { e.stopPropagation(); toggleWishlist(p.id) }} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Heart className={cx('w-3.5 h-3.5', inWish ? 'fill-accent text-accent' : 'text-foreground')} />
        </button>
        {p.onSale && <Badge className="absolute top-3 left-3 rounded-none bg-accent text-accent-foreground">Sale</Badge>}
      </div>
      <div className="mt-4 space-y-1">
        <div className="text-[10px] tracking-editorial uppercase text-muted-foreground">{p.collection}</div>
        <div className="font-serif text-lg leading-tight">{p.name}</div>
        <div className="text-sm">
          {p.salePrice ? <><span className="text-accent">{money(p.salePrice, settings.currencySymbol)}</span> <span className="line-through text-muted-foreground ml-2">{money(p.price, settings.currencySymbol)}</span></> : money(p.price, settings.currencySymbol)}
        </div>
        {stockStatusText && <div className="text-[11px] tracking-editorial uppercase text-destructive">{stockStatusText}</div>}
        {p.colors?.length > 0 && (
          <div className="flex gap-1 pt-1">
            {p.colors.slice(0, 5).map(c => <span key={c} title={c} className="w-2.5 h-2.5 rounded-full border border-border" style={{ background: colorHex(c) }} />)}
            {p.colors.length > 5 && <span className="text-[10px] text-muted-foreground ml-1">+{p.colors.length - 5}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Page Section Renderers ----------
function PageSection({ section }) {
  if (!section.visible) return null
  if (section.type === 'hero-banner') return <HeroBannerSection section={section} />
  if (section.type === 'editorial-text') return <EditorialTextSection section={section} />
  if (section.type === 'lookbook-strip') return <LookbookStripSection section={section} />
  if (section.type === 'promo-banner') return <PromoBannerSection section={section} />

  if (section.type === 'core-shop') return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12 md:py-20 pointer-events-none opacity-90">
      <div className="text-center mb-12">
        <div className="text-[11px] tracking-luxe uppercase text-accent mb-4">{section.content?.eyebrow || 'The Boutique'}</div>
        <h1 className="font-serif text-5xl md:text-6xl">{section.content?.title || 'Shop All'}</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 md:gap-12">
        <aside className="space-y-8 hidden md:block opacity-60">
          <div className="h-10 bg-muted w-full mb-8" />
          <div className="h-40 bg-muted w-full mb-8" />
          <div className="h-20 bg-muted w-full" />
        </aside>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="opacity-80">
              <div className="bg-muted mb-4" style={{ aspectRatio: section.content?.aspectRatio || '3/4' }} />
              <div className="h-4 bg-muted w-3/4 mb-2" />
              <div className="h-3 bg-muted w-1/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
  if (section.type === 'core-concierge') return (
    <div className="max-w-3xl mx-auto px-4 py-24 pointer-events-none opacity-90">
      <div className="text-center mb-12">
        <div className="text-[11px] tracking-luxe uppercase text-accent mb-4">Private Concierge</div>
        <h1 className="font-serif text-5xl">{section.content?.title || 'Concierge'}</h1>
        <p className="whitespace-pre-line text-muted-foreground mt-4">{section.content?.subtitle || 'Private booking inquiry form'}</p>
      </div>
      <div className="space-y-4 opacity-60">
        <div className="h-12 bg-muted w-full" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-12 bg-muted w-full" />
          <div className="h-12 bg-muted w-full" />
        </div>
        <div className="h-32 bg-muted w-full" />
        <div className="h-12 bg-accent/30 w-1/3" />
      </div>
    </div>
  )

  return null
}

function HeroBannerSection({ section }) {
  const { navigate } = useApp()
  const { content = {}, style = {} } = section
  const height = style.height || '50vh'
  const opacity = style.overlayOpacity ?? 0.4
  const align = style.textAlign || 'center'
  return (
    <section className="relative overflow-hidden" style={{ height }}>
      {content.image && <img src={content.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      {content.image && <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${opacity})` }} />}
      <div className={cx('relative z-10 h-full flex flex-col justify-end pb-16 px-8', align === 'center' && 'items-center text-center', align === 'left' && 'items-start', align === 'right' && 'items-end')}>
        {content.subtitle && <div className="whitespace-pre-line text-white/80 text-[11px] tracking-luxe uppercase mb-4">{content.subtitle}</div>}
        {content.title && <h2 className="font-serif text-white text-5xl md:text-7xl font-light leading-tight">{content.title}</h2>}
        {content.ctaLabel && (
          <button onClick={() => content.ctaAction && navigate(content.ctaAction)} className="mt-8 rounded-none bg-white text-black hover:bg-white/90 h-12 px-10 tracking-editorial uppercase text-xs">{content.ctaLabel}</button>
        )}
      </div>
    </section>
  )
}

function EditorialTextSection({ section }) {
  const { content = {}, style = {} } = section
  const align = style.textAlign || 'center'
  return (
    <section className="py-20 md:py-28 px-6">
      <div className={cx('max-w-3xl mx-auto', align === 'left' && 'text-left', align === 'right' && 'text-right', align === 'center' && 'text-center')}>
        {content.label && <div className="text-[11px] tracking-luxe uppercase text-accent mb-4">{content.label}</div>}
        {content.title && <h2 className="font-serif text-4xl md:text-5xl mb-6">{content.title}</h2>}
        {content.title && <div className="divider-gold mx-auto w-32 mb-8" />}
        {content.body && <p className="whitespace-pre-line text-muted-foreground leading-relaxed text-base">{content.body}</p>}
      </div>
    </section>
  )
}

function LookbookStripSection({ section }) {
  const { content = {} } = section
  const images = (content.images || []).filter(Boolean)
  if (!images.length) return null
  return (
    <section className="py-16 max-w-[1400px] mx-auto px-4 md:px-8">
      <div className="grid md:grid-cols-3 gap-2 md:gap-4">
        {images.map((img, i) => (
          <div key={i} className={cx('img-zoom', content.offset && i === 1 ? 'md:mt-16' : '')}>
            <img src={img} alt="" className="w-full aspect-[3/4] object-cover" />
          </div>
        ))}
      </div>
    </section>
  )
}

function PromoBannerSection({ section }) {
  const { navigate } = useApp()
  const { content = {}, style = {} } = section
  const dark = style.bgColor !== 'light'
  return (
    <section className={cx('py-16 px-6 text-center', dark ? 'bg-primary text-primary-foreground' : 'bg-muted/40')}>
      <div className="max-w-2xl mx-auto">
        {content.text && <p className={cx('whitespace-pre-line font-serif text-3xl md:text-4xl mb-6', dark && 'text-primary-foreground')}>{content.text}</p>}
        {content.ctaLabel && (
          <button onClick={() => content.ctaAction && navigate(content.ctaAction)}
            className={cx('rounded-none h-12 px-10 tracking-editorial uppercase text-xs border', dark ? 'border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary' : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground', 'transition-colors')}>
            {content.ctaLabel}
          </button>
        )}
      </div>
    </section>
  )
}

// ---------- Shop ----------
function ShopView() {
  const { api, view, collections, allProducts, settings, navigate } = useApp()
  const [products, setProducts] = useState([])
  const [filters, setFilters] = useState({ collection: view.params.collection || '', size: '', color: '', minPrice: '', maxPrice: '', search: '', sort: '' })
  const [loading, setLoading] = useState(true)
  const activeCollection = collections.find(collection => collection.slug === filters.collection)
  const activeCollectionSlugs = activeCollection
    ? [activeCollection.slug, ...collections.filter(collection => collection.parentSlug === activeCollection.slug).map(collection => collection.slug)]
    : []
  const scopedProducts = activeCollection
    ? allProducts.filter(product => activeCollectionSlugs.includes(product.collection))
    : allProducts

  useEffect(() => {
    setFilters(prev => ({ ...prev, collection: view.params.collection || '' }))
  }, [view.params.collection])

  useEffect(() => {
    setLoading(true)
    const q = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => v && q.append(k, v))
    api(`/products?${q.toString()}`).then(r => setProducts(r.products)).finally(() => setLoading(false))
  }, [filters, api])

  const pageKey = 'shop'
  let pageSections = settings.pageLayouts?.[pageKey]?.sections || []
  if (!pageSections.find(s => s.type === 'core-shop')) {
    pageSections = [...pageSections, { id: `core-${pageKey}`, type: 'core-shop', visible: true, order: 999 }]
  }
  const sortedSections = [...pageSections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return (
    <div className="pt-24 min-h-screen">
      {sortedSections.map(s => {
        if (!s.visible) return null
        if (s.type === 'core-shop') {
          return (
            <div key={s.id} className="max-w-[1400px] mx-auto px-4 md:px-8 py-12 md:py-20">
              <div className="text-center mb-8 fade-in">
                <div className="text-[11px] tracking-luxe uppercase text-accent mb-4">{s.content?.eyebrow || 'The Boutique'}</div>
                <h1 className="font-serif text-5xl md:text-6xl uppercase">{activeCollection?.name || s.content?.title || 'Shop All'}</h1>
              </div>
              <div className="max-w-xl mx-auto mb-12">
                <Label className="sr-only" htmlFor="shop-search">Search pieces</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="shop-search" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="Search pieces..." className="h-12 rounded-none pl-10 text-center" />
                </div>
              </div>
              <div>
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-xs text-muted-foreground">{loading ? 'Loading...' : `${products.length} pieces`}</div>
                    <Select value={filters.sort} onValueChange={v => setFilters(f => ({ ...f, sort: v }))}>
                      <SelectTrigger className="w-[200px] rounded-none"><SelectValue placeholder="Sort by" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="price_asc">Price: Low to High</SelectItem>
                        <SelectItem value="price_desc">Price: High to Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
                    {products.map(p => <ProductCard key={p.id} p={p} aspectRatio={s.content?.aspectRatio || '3/4'} />)}
                  </div>
                  {!loading && products.length === 0 && <div className="text-center py-24 text-muted-foreground">No pieces match your filters.</div>}
                </div>
              </div>
            </div>
          )
        }
        return <PageSection key={s.id} section={s} />
      })}
    </div>
  )
}

// ---------- Product Detail ----------
function ProductView() {
  const { api, view, settings, collections, addToCart, toggleWishlist, wishlist, navigate } = useApp()
  const [product, setProduct] = useState(null)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [activeImg, setActiveImg] = useState(0)
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)

  useEffect(() => { api(`/products/${view.params.id}`).then(r => { setProduct(r.product); setSize(r.product.sizes?.[0] || ''); setColor(r.product.colors?.[0] || '') }) }, [view.params.id, api])

  if (!product) return <div className="py-32 text-center text-muted-foreground">Loading...</div>
  const inWish = wishlist.includes(product.id)
  const stockStatusText = getStockStatusText(product)
  const productCollection = collections.find(collection => collection.slug === product.collection)
  const parentCollection = productCollection?.parentSlug ? collections.find(collection => collection.slug === productCollection.parentSlug) : null
  const collectionTrail = [parentCollection?.name, productCollection?.name || product.collection].filter(Boolean).join(', ')

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 md:py-16">
      <div className="text-xs text-muted-foreground mb-6 tracking-editorial uppercase">
        <button onClick={() => navigate('shop')}>Shop</button> <ChevronRight className="inline w-3 h-3" /> <span className="uppercase">{collectionTrail}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-8 md:gap-16">
        <div>
          <button
            type="button"
            onClick={() => setImageOpen(true)}
            className="group relative block w-full aspect-[3/4] bg-muted overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`View larger image of ${product.name}`}>
            <img src={product.images?.[activeImg]} alt={product.name} className="w-full h-full object-cover" />
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 bg-background/90 px-3 py-2 text-[10px] tracking-editorial uppercase opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <ZoomIn className="h-3.5 w-3.5" /> View image
            </span>
          </button>
          {product.images?.length > 1 && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {product.images.map((im, i) => (
                <button key={i} onClick={() => setActiveImg(i)} className={cx('aspect-[3/4] overflow-hidden', activeImg === i ? 'ring-2 ring-accent' : '')}>
                  <img src={im} alt={`${product.name} view ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="md:sticky md:top-28 h-fit">
          <div className="text-[11px] tracking-luxe uppercase text-accent mb-3">{collectionTrail}</div>
          <h1 className="font-serif text-4xl md:text-5xl">{product.name}</h1>
          <div className="mt-4 text-lg">
            {product.salePrice ? <><span className="text-accent">{money(product.salePrice, settings.currencySymbol)}</span> <span className="line-through text-muted-foreground ml-2">{money(product.price, settings.currencySymbol)}</span></> : money(product.price, settings.currencySymbol)}
          </div>
          {stockStatusText && <div className="mt-3 inline-flex items-center rounded-none border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] tracking-editorial uppercase text-destructive">{stockStatusText}</div>}
          <p className="text-muted-foreground mt-6 leading-relaxed whitespace-pre-wrap">{product.description}</p>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-[11px] tracking-editorial uppercase text-muted-foreground">Size</Label>
              <span className="text-[11px] tracking-editorial uppercase text-muted-foreground">Size Guide</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.sizes?.map(s => <button key={s} onClick={() => setSize(s)} className={cx('px-4 py-2 border text-xs', size === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>{s}</button>)}
            </div>
          </div>

          <div className="mt-6 rounded-none border border-border p-4">
            <div className="text-[11px] tracking-editorial uppercase text-muted-foreground mb-3">Size Guide</div>
            <p className="text-sm whitespace-pre-wrap">{product.sizeGuide || 'Please contact our concierge for bespoke fit guidance and sizing support.'}</p>
          </div>
          <div className="mt-6">
            <Label className="text-[11px] tracking-editorial uppercase text-muted-foreground">Colour: {color}</Label>
            <div className="mt-3 flex gap-2 flex-wrap">
              {product.colors?.map(c => (
                <button key={c} onClick={() => setColor(c)} className={cx('flex items-center gap-2 px-3 py-2 border text-xs', color === c ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                  <span className="inline-block w-3.5 h-3.5 rounded-full border border-border" style={{ background: colorHex(c) }} />{c}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <Button className="flex-1 rounded-none h-12 tracking-editorial uppercase text-xs" onClick={() => addToCart(product, size, color)} disabled={Number(product.stock) <= 0}>{Number(product.stock) <= 0 ? 'Out of Stock' : 'Add to Bag'}</Button>
            <Button variant="outline" className="rounded-none h-12 w-12 p-0" onClick={() => toggleWishlist(product.id)}>
              <Heart className={cx('w-4 h-4', inWish && 'fill-accent text-accent')} />
            </Button>
          </div>
          <Button variant="ghost" className="mt-3 w-full rounded-none h-12 tracking-editorial uppercase text-xs underline underline-offset-4" onClick={() => setInquiryOpen(true)}>Enquire About This Piece</Button>

          <div className="mt-10 space-y-6 border-t border-border pt-8">
            <div>
              <div className="text-[11px] tracking-editorial uppercase text-muted-foreground mb-2">Material & Craft</div>
              <p className="text-sm whitespace-pre-wrap">{product.material}</p>
            </div>
            <div>
              <div className="text-[11px] tracking-editorial uppercase text-muted-foreground mb-2">Care</div>
              <p className="text-sm whitespace-pre-wrap">{product.care}</p>
            </div>
            <div className="flex gap-6 text-xs tracking-editorial uppercase text-muted-foreground">
              <div className="flex items-center gap-2"><Truck className="w-3.5 h-3.5" /> {Number(product.shipping) > 0 ? `Shipping ${money(Number(product.shipping), settings.currencySymbol)}` : 'COMPLIMENTARY SHIPPING'}</div>
              <div className="flex items-center gap-2"><Package className="w-3.5 h-3.5" /> SKU: {product.sku}</div>
            </div>
          </div>
        </div>
      </div>

      <ProductImageDialog open={imageOpen} onOpenChange={setImageOpen} image={product.images?.[activeImg]} productName={product.name} />
      <InquiryDialog open={inquiryOpen} onOpenChange={setInquiryOpen} productId={product.id} productName={product.name} />
    </div>
  )
}

function ProductImageDialog({ open, onOpenChange, image, productName }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl border-none bg-black/95 p-3 text-white sm:p-6">
        <DialogTitle className="sr-only">{productName} product image</DialogTitle>
        <div className="flex min-h-[50vh] items-center justify-center">
          <img src={image} alt={productName} className="max-h-[80vh] w-auto max-w-full object-contain" />
        </div>
        <p className="text-center text-sm text-white/80">{productName}</p>
      </DialogContent>
    </Dialog>
  )
}

function InquiryDialog({ open, onOpenChange, productId, productName }) {
  const { api } = useApp()
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const submit = async () => {
    try {
      await api('/inquiries', { method: 'POST', body: { ...form, productId, subject: productName ? `Enquiry: ${productName}` : 'General Enquiry' } })
      toast.success('Enquiry received. Our concierge will contact you.')
      onOpenChange(false); setForm({ name: '', email: '', phone: '', message: '' })
    } catch (e) { toast.error(e.message) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none max-w-lg">
        <DialogHeader><DialogTitle className="font-serif text-2xl">Private Enquiry</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <Input placeholder="Full Name" className="rounded-none" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Email" className="rounded-none" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Phone" className="rounded-none" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <Textarea placeholder="How may we assist?" rows={4} className="rounded-none" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
        </div>
        <DialogFooter><Button className="rounded-none tracking-editorial uppercase text-xs" onClick={submit}>Send Enquiry</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Cart ----------
function CartView() {
  const { cart, updateQty, removeFromCart, navigate, settings, requestCheckoutAccess } = useApp()
  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0)
  const shipping = cart.reduce((sum, item) => sum + (Number(item.shipping) || 0) * item.qty, 0)
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-16">
      <h1 className="font-serif text-5xl mb-10 text-center">Your Bag</h1>
      {cart.length === 0
        ? <div className="text-center text-muted-foreground py-20">Your bag is empty. <button className="underline ml-2" onClick={() => navigate('shop')}>Continue shopping →</button></div>
        : <>
          <div className="space-y-8">
            {cart.map(item => (
              <div key={item.key} className="grid grid-cols-[100px_1fr_auto] gap-6 pb-8 border-b border-border">
                <img src={item.image} className="w-24 h-32 object-cover" />
                <div>
                  <div className="font-serif text-xl">{item.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{item.color} · Size {item.size}</div>
                  <div className="flex items-center border border-border w-fit mt-4">
                    <button className="px-3 py-2" onClick={() => updateQty(item.key, item.qty - 1)}><Minus className="w-3 h-3" /></button>
                    <span className="px-4 text-sm">{item.qty}</span>
                    <button className="px-3 py-2" onClick={() => updateQty(item.key, item.qty + 1)}><Plus className="w-3 h-3" /></button>
                  </div>
                </div>
                <div className="text-right">
                  <div>{money(item.price * item.qty, settings.currencySymbol)}</div>
                  <button className="text-xs text-muted-foreground mt-3 underline" onClick={() => removeFromCart(item.key)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex justify-end">
            <div className="w-full md:w-96 space-y-4">
              <div className="flex justify-between"><span className="tracking-editorial uppercase text-xs">Subtotal</span><span>{money(subtotal, settings.currencySymbol)}</span></div>
              <div className="flex justify-between"><span className="tracking-editorial uppercase text-xs">Shipping</span><span className={shipping === 0 ? 'text-accent tracking-editorial text-xs' : ''}>{shipping === 0 ? 'COMPLIMENTARY SHIPPING' : money(shipping, settings.currencySymbol)}</span></div>
              <div className="flex justify-between font-serif text-lg pt-3 border-t border-border"><span>Total</span><span>{money(subtotal + shipping, settings.currencySymbol)}</span></div>
              <Button className="w-full rounded-none h-12 tracking-editorial uppercase text-xs" onClick={() => requestCheckoutAccess()}>Proceed to Checkout</Button>
            </div>
          </div>
        </>}
    </div>
  )
}

// ---------- Checkout ----------
function CheckoutView() {
  const { cart, user, settings, api, navigate, clearCart, requestCheckoutAccess } = useApp()
  const [form, setForm] = useState({
    customerName: user?.name || '', customerEmail: user?.email || '', customerPhone: '',
    line1: '', line2: '', city: '', state: '', pincode: '', country: 'India', notes: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0)
  const shipping = cart.reduce((sum, item) => sum + (Number(item.shipping) || 0) * item.qty, 0)
  const total = subtotal + shipping
  const validation = useMemo(() => validateCheckoutForm(form), [form])
  const errors = submitAttempted ? validation.errors : {}

  useEffect(() => {
    if (!user && cart.length > 0) requestCheckoutAccess()
  }, [user, cart.length, requestCheckoutAccess])

  useEffect(() => {
    setForm(prev => ({ ...prev, customerName: user?.name || prev.customerName, customerEmail: user?.email || prev.customerEmail }))
  }, [user])

  if (cart.length === 0) return <div className="text-center py-32 text-muted-foreground">Your bag is empty. <button className="underline ml-2" onClick={() => navigate('shop')}>Continue shopping →</button></div>

  const submit = async () => {
    setSubmitAttempted(true)
    if (!validation.isValid) {
      toast.error('Please complete the required checkout details before continuing.')
      return
    }
    setSubmitting(true)
    try {
      const r = await api('/orders', {
        method: 'POST', body: {
          customerName: form.customerName, customerEmail: form.customerEmail, customerPhone: form.customerPhone,
          items: cart, subtotal, shipping, total,
          shippingAddress: { line1: form.line1, line2: form.line2, city: form.city, state: form.state, pincode: form.pincode, country: form.country },
          notes: form.notes,
        }
      })
      clearCart()
      navigate('order-success', { orderNumber: r.order.orderNumber, orderId: r.order.id })
    } catch (e) { toast.error(e.message) } finally { setSubmitting(false) }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-16">
      <h1 className="font-serif text-5xl mb-10 text-center">Checkout</h1>
      <div className="grid md:grid-cols-[1fr_400px] gap-12">
        <div className="space-y-8">
          <section>
            <h2 className="font-serif text-2xl mb-4">Contact</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Input placeholder="Full Name" className={cx('rounded-none', errors.customerName && 'border-red-500')} value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
                {errors.customerName && <p className="text-xs text-red-600 mt-2">{errors.customerName}</p>}
              </div>
              <div>
                <Input placeholder="Email" className={cx('rounded-none', errors.customerEmail && 'border-red-500')} value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })} />
                {errors.customerEmail && <p className="text-xs text-red-600 mt-2">{errors.customerEmail}</p>}
              </div>
              <div className="md:col-span-2">
                <Input placeholder="Phone" className={cx('rounded-none', errors.customerPhone && 'border-red-500')} value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} />
                {errors.customerPhone && <p className="text-xs text-red-600 mt-2">{errors.customerPhone}</p>}
              </div>
            </div>
          </section>
          <section>
            <h2 className="font-serif text-2xl mb-4">Shipping Address</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input placeholder="Address Line 1" className={cx('rounded-none', errors.line1 && 'border-red-500')} value={form.line1} onChange={e => setForm({ ...form, line1: e.target.value })} />
                {errors.line1 && <p className="text-xs text-red-600 mt-2">{errors.line1}</p>}
              </div>
              <Input placeholder="Address Line 2 (optional)" className="rounded-none md:col-span-2" value={form.line2} onChange={e => setForm({ ...form, line2: e.target.value })} />
              <div>
                <Input placeholder="City" className={cx('rounded-none', errors.city && 'border-red-500')} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                {errors.city && <p className="text-xs text-red-600 mt-2">{errors.city}</p>}
              </div>
              <div>
                <Input placeholder="State" className={cx('rounded-none', errors.state && 'border-red-500')} value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
                {errors.state && <p className="text-xs text-red-600 mt-2">{errors.state}</p>}
              </div>
              <div>
                <Input placeholder="PIN Code" className={cx('rounded-none', errors.pincode && 'border-red-500')} value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} />
                {errors.pincode && <p className="text-xs text-red-600 mt-2">{errors.pincode}</p>}
              </div>
              <Input placeholder="Country" className="rounded-none" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
            </div>
          </section>
          <section>
            <h2 className="font-serif text-2xl mb-4">Notes for the Atelier</h2>
            <Textarea rows={3} className="rounded-none" placeholder="Gift note, preferred delivery date, etc." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </section>
        </div>
        <aside className="bg-muted/40 p-8">
          <h2 className="font-serif text-2xl mb-6">Order Summary</h2>
          <div className="space-y-4 pb-6 border-b border-border">
            {cart.map(item => (
              <div key={item.key} className="flex gap-3 items-center">
                <img src={item.image} className="w-14 h-20 object-cover" />
                <div className="flex-1 text-sm">
                  <div>{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.color} · {item.size} · x{item.qty}</div>
                </div>
                <div className="text-sm">{money(item.price * item.qty, settings.currencySymbol)}</div>
              </div>
            ))}
          </div>
          <div className="pt-6 space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal, settings.currencySymbol)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span className={shipping === 0 ? 'text-accent tracking-editorial text-xs' : ''}>{shipping === 0 ? 'COMPLIMENTARY SHIPPING' : money(shipping, settings.currencySymbol)}</span></div>
            <div className="flex justify-between font-serif text-lg pt-3 border-t border-border"><span>Total</span><span>{money(total, settings.currencySymbol)}</span></div>
          </div>
          <div className="mt-6 text-xs text-muted-foreground bg-background/70 p-4 border border-border">
            Payment is arranged privately by our concierge after your order is confirmed. Submitting this form places a reserved enquiry with the atelier.
          </div>
          <Button disabled={submitting || !validation.isValid || !user} className="w-full rounded-none h-12 tracking-editorial uppercase text-xs mt-6" onClick={submit}>{submitting ? 'Submitting…' : !user ? 'Sign in to continue' : validation.isValid ? 'Place Enquiry Order' : 'Complete details'}</Button>
        </aside>
      </div>
    </div>
  )
}

function OrderSuccessView() {
  const { view, navigate, setFeedbackOpen } = useApp()
  useEffect(() => { setFeedbackOpen(true) }, [setFeedbackOpen])
  return (
    <div className="max-w-2xl mx-auto text-center py-32 px-6">
      <div className="w-16 h-16 mx-auto rounded-full border border-accent flex items-center justify-center mb-8"><Check className="w-6 h-6 text-accent" /></div>
      <h1 className="font-serif text-5xl mb-4">Thank you.</h1>
      <p className="text-muted-foreground mb-2">Your enquiry order has been received.</p>
      <p className="text-sm mb-8">Order reference: <span className="tracking-editorial">{view.params.orderNumber}</span></p>
      <p className="text-sm text-muted-foreground mb-10">A member of our concierge will contact you within one business day to confirm details and arrange payment privately.</p>
      <div className="flex gap-3 justify-center">
        <Button className="rounded-none tracking-editorial uppercase text-xs h-12 px-8" onClick={() => navigate('shop')}>Continue Shopping</Button>
        <Button variant="outline" className="rounded-none tracking-editorial uppercase text-xs h-12 px-8" onClick={() => navigate('dashboard')}>View Orders</Button>
      </div>
    </div>
  )
}

// ---------- Auth ----------
function AuthLayout({ title, sub, children }) {
  return (
    <div className="max-w-md mx-auto px-4 py-24">
      <div className="text-center mb-10">
        <div className="text-[11px] tracking-luxe uppercase text-accent mb-4">YASH Maison</div>
        <h1 className="font-serif text-4xl">{title}</h1>
        {sub && <p className="text-muted-foreground mt-2 text-sm">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function LoginView() {
  const { api, setAuth, navigate } = useApp()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true)
    try { const r = await api('/auth/login', { method: 'POST', body: form }); setAuth(r.token, r.user); toast.success(`Welcome, ${r.user.name}`); navigate(r.user.role === 'admin' ? 'admin' : 'dashboard') }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  return (
    <AuthLayout title="Sign In" sub="Access your private account">
      <div className="space-y-4">
        <Input placeholder="Email" className="rounded-none h-12" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <Input type="password" placeholder="Password" className="rounded-none h-12" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <Button disabled={loading} className="w-full rounded-none h-12 tracking-editorial uppercase text-xs" onClick={submit}>{loading ? 'Signing in…' : 'Sign In'}</Button>
        <div className="flex justify-between text-xs pt-2">
          <button className="underline" onClick={() => navigate('forgot')}>Forgot password?</button>
          <button className="underline" onClick={() => navigate('register')}>Create an account</button>
        </div>
      </div>
    </AuthLayout>
  )
}

function AdminLoginView() {
  const { api, setAuth, navigate } = useApp()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true)
    try {
      const r = await api('/auth/login', { method: 'POST', body: form })
      if (r.user.role !== 'admin') { toast.error('This portal is restricted to atelier staff.'); setLoading(false); return }
      setAuth(r.token, r.user)
      if (typeof window !== 'undefined') history.replaceState(null, '', window.location.pathname)
      toast.success('Welcome to the Atelier'); navigate('admin')
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen -mt-20 bg-primary text-primary-foreground flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="text-[11px] tracking-luxe uppercase text-accent mb-4">Restricted Access</div>
          <h1 className="font-serif text-5xl">Atelier Portal</h1>
          <p className="text-primary-foreground/60 mt-3 text-sm">This entrance is reserved for members of the YASH atelier.</p>
        </div>
        <div className="space-y-4">
          <Input placeholder="Atelier Email" className="rounded-none h-12 bg-transparent border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/50" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input type="password" placeholder="Password" className="rounded-none h-12 bg-transparent border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/50" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <Button disabled={loading} className="w-full rounded-none h-12 tracking-editorial uppercase text-xs bg-accent text-accent-foreground hover:bg-accent/90" onClick={submit}>{loading ? 'Entering…' : 'Enter Atelier'}</Button>
          <button className="text-[11px] tracking-editorial uppercase text-primary-foreground/50 mx-auto block mt-6" onClick={() => { if (typeof window !== 'undefined') history.replaceState(null, '', window.location.pathname); navigate('home') }}>← Return to Boutique</button>
        </div>
      </div>
    </div>
  )
}

function RegisterView() {
  const { api, setAuth, navigate } = useApp()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true)
    try { const r = await api('/auth/register', { method: 'POST', body: form }); setAuth(r.token, r.user); toast.success('Welcome to YASH'); navigate('dashboard') }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  return (
    <AuthLayout title="Create Account" sub="Join our private clientele">
      <div className="space-y-4">
        <Input placeholder="Full Name" className="rounded-none h-12" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Email" className="rounded-none h-12" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <Input placeholder="Phone Number" className="rounded-none h-12" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <Input type="password" placeholder="Password" className="rounded-none h-12" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <Button disabled={loading} className="w-full rounded-none h-12 tracking-editorial uppercase text-xs" onClick={submit}>{loading ? 'Creating account…' : 'Create Account'}</Button>
        <div className="text-xs text-center pt-2"><button className="underline" onClick={() => navigate('login')}>Already have an account?</button></div>
      </div>
    </AuthLayout>
  )
}

function ForgotView() {
  const { api, navigate } = useApp()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true)
    try {
      const r = await api('/auth/forgot', { method: 'POST', body: { email } })
      setSent(true)
      toast.success(r.message || 'Reset instructions have been sent to your inbox.')
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  return (
    <AuthLayout title="Password Recovery" sub="We will send you a private link">
      <div className="space-y-4">
        <Input placeholder="Email" className="rounded-none h-12" value={email} onChange={e => setEmail(e.target.value)} />
        <Button disabled={loading} className="w-full rounded-none h-12 tracking-editorial uppercase text-xs" onClick={submit}>{loading ? 'Preparing reset…' : 'Send Reset Link'}</Button>
        {sent && (
          <div className="text-xs bg-muted/40 p-4 border border-border space-y-3">
            <div className="tracking-editorial uppercase text-accent">Email sent</div>
            <div className="text-sm text-muted-foreground">Please check your inbox for a secure link to continue. If it doesn’t arrive within a couple of minutes, try again.</div>
            <Button variant="outline" className="rounded-none w-full" onClick={() => navigate('reset')}>Continue to reset form →</Button>
          </div>
        )}
        <div className="text-xs text-center"><button className="underline" onClick={() => navigate('login')}>Back to sign in</button></div>
      </div>
    </AuthLayout>
  )
}

function ResetView() {
  const { api, navigate } = useApp()
  const [form, setForm] = useState({ token: '', newPassword: '' })
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) setForm(prev => ({ ...prev, token }))
  }, [])
  const submit = async () => {
    setLoading(true)
    try { await api('/auth/reset', { method: 'POST', body: form }); toast.success('Password reset. Please sign in.'); navigate('login') }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  return (
    <AuthLayout title="Set New Password" sub="Use the secure link from your email to continue">
      <div className="space-y-4">
        <Input placeholder="Reset Token (paste)" className="rounded-none h-12 font-mono text-xs" value={form.token} onChange={e => setForm({ ...form, token: e.target.value })} />
        <Input type="password" placeholder="New Password" className="rounded-none h-12" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} />
        <Button disabled={loading} className="w-full rounded-none h-12 tracking-editorial uppercase text-xs" onClick={submit}>{loading ? 'Resetting…' : 'Reset Password'}</Button>
      </div>
    </AuthLayout>
  )
}

// ---------- Concierge / About ----------
function ConciergeView() {
  const { settings, api } = useApp()
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const submit = async () => {
    if (!form.name || !form.email || !form.phone || !form.message) { toast.error('Please fill name, email, phone and message'); return }
    try {
      await api('/inquiries', { method: 'POST', body: form })
      toast.success('Your enquiry has been received.')
      setForm({ name: '', email: '', phone: '', subject: '', message: '' })
    } catch (e) { toast.error(e.message) }
  }
  // Layout-aware: render page sections above the form
  let pageSections = settings?.pageLayouts?.concierge?.sections || []
  if (!pageSections.find(s => s.type === 'core-concierge')) {
    pageSections = [...pageSections, { id: 'core-concierge', type: 'core-concierge', visible: true, order: 999 }]
  }
  const sortedSections = [...pageSections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return (
    <div className="pt-24 min-h-screen">
      {sortedSections.map(s => {
        if (!s.visible) return null
        if (s.type === 'core-concierge') {
          return (
            <div key={s.id} className="max-w-3xl mx-auto px-4 py-24">
              <div className="text-center mb-12">
                <div className="text-[11px] tracking-luxe uppercase text-accent mb-4">Private Concierge</div>
                <h1 className="font-serif text-5xl">{s.content?.title || settings.concierge?.title || 'Concierge'}</h1>
                <p className="whitespace-pre-line text-muted-foreground mt-4">{s.content?.subtitle || settings.concierge?.subtitle}</p>
              </div>
              <div className="grid md:grid-cols-2 gap-8 mb-12 text-sm">
                <div className="border border-border p-6">
                  <div className="text-[11px] tracking-editorial uppercase text-muted-foreground mb-2">Write to us</div>
                  <div>{settings.concierge?.email}</div>
                </div>
                <div className="border border-border p-6">
                  <div className="text-[11px] tracking-editorial uppercase text-muted-foreground mb-2">By Telephone</div>
                  <div>{settings.concierge?.phone}</div>
                </div>
              </div>
              <div className="space-y-4">
                <Input placeholder="Full Name" className="rounded-none h-12" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <div className="grid md:grid-cols-2 gap-4">
                  <Input placeholder="Email" className="rounded-none h-12" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  <Input placeholder="Phone" className="rounded-none h-12" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <Input placeholder="Subject" className="rounded-none h-12" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
                <Textarea placeholder="How may we assist?" rows={6} className="rounded-none" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
                <Button className="rounded-none h-12 tracking-editorial uppercase text-xs px-10" onClick={submit}>{s.content?.ctaLabel || 'Send Enquiry'}</Button>
              </div>
            </div>
          )
        }
        return <PageSection key={s.id} section={s} />
      })}
    </div>
  )
}

function AboutView() {
  const { settings } = useApp()
  return (
    <div className="max-w-3xl mx-auto py-24 px-6 text-center">
      <div className="text-[11px] tracking-luxe uppercase text-accent mb-6">Maison</div>
      <h1 className="font-serif text-5xl mb-6">{settings.aboutTitle}</h1>
      <div className="divider-gold mx-auto w-32 mb-8" />
      <p className="whitespace-pre-line text-muted-foreground leading-relaxed">{settings.aboutBody}</p>
    </div>
  )
}

// ---------- Customer Dashboard ----------
function DashboardView() {
  const { user, api, navigate, setAuth, settings } = useApp()
  const [orders, setOrders] = useState([])
  const [wishlistData, setWishlistData] = useState([])
  const [addresses, setAddresses] = useState([])
  const [tab, setTab] = useState('orders')

  useEffect(() => {
    if (!user) { navigate('login'); return }
    api('/orders').then(r => setOrders(r.orders || []))
    api('/wishlist').then(r => setWishlistData(r.products || []))
    api('/addresses').then(r => setAddresses(r.addresses || []))
  }, [user])

  if (!user) return null

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-16">
      <div className="flex items-end justify-between mb-10">
        <div>
          <div className="text-[11px] tracking-luxe uppercase text-accent mb-2">Private Account</div>
          <h1 className="font-serif text-5xl">Welcome, {user.name}</h1>
        </div>
        <button className="text-xs tracking-editorial uppercase underline flex items-center gap-2" onClick={() => { setAuth(null, null); navigate('home') }}><LogOut className="w-3.5 h-3.5" /> Sign Out</button>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-auto p-0">
          {['orders', 'wishlist', 'addresses', 'enquiries'].map(t => (
            <TabsTrigger key={t} value={t} className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-accent tracking-editorial uppercase text-xs px-6 py-3">{t}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="orders" className="pt-8">
          {orders.length === 0
            ? <div className="text-muted-foreground text-sm py-12 text-center">No orders yet.</div>
            : <div className="space-y-6">
              {orders.map(o => (
                <div key={o.id} className="border border-border p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="text-[11px] tracking-editorial uppercase text-muted-foreground">Order</div>
                      <div className="font-serif text-2xl">{o.orderNumber}</div>
                      <div className="text-xs text-muted-foreground mt-1">Placed {new Date(o.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <Badge className="rounded-none bg-accent text-accent-foreground">{o.status}</Badge>
                      {o.trackingNumber && <div className="text-xs mt-2">Tracking: {o.trackingNumber}</div>}
                      <div className="text-lg mt-2">{money(o.total, settings.currencySymbol)}</div>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {o.items?.map(it => (
                      <div key={it.key} className="flex gap-3 text-sm items-center">
                        <img src={it.image} className="w-12 h-16 object-cover" />
                        <div>
                          <div>{it.name}</div>
                          <div className="text-xs text-muted-foreground">{it.color} · {it.size} · x{it.qty}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {o.history?.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="text-[11px] tracking-editorial uppercase text-muted-foreground mb-2">Tracking</div>
                      <div className="space-y-1 text-xs">
                        {o.history.map((h, i) => (<div key={i} className="flex gap-3"><span className="text-accent">●</span><span>{h.status}</span><span className="text-muted-foreground">{new Date(h.at).toLocaleString()}</span></div>))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>}
        </TabsContent>
        <TabsContent value="wishlist" className="pt-8">
          {wishlistData.length === 0
            ? <div className="text-muted-foreground text-sm py-12 text-center">Your wishlist is empty.</div>
            : <div className="grid grid-cols-2 md:grid-cols-4 gap-6">{wishlistData.map(p => <ProductCard key={p.id} p={p} />)}</div>}
        </TabsContent>
        <TabsContent value="addresses" className="pt-8">
          <AddressManager addresses={addresses} setAddresses={setAddresses} />
        </TabsContent>
        <TabsContent value="enquiries" className="pt-8">
          <CustomerEnquiries />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AddressManager({ addresses, setAddresses }) {
  const { api } = useApp()
  const [editing, setEditing] = useState(null)
  const empty = { label: '', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' }
  const save = async () => {
    try {
      if (editing.id) { await api(`/addresses/${editing.id}`, { method: 'PUT', body: editing }) }
      else { const r = await api('/addresses', { method: 'POST', body: editing }); setAddresses(a => [...a, r.address]); setEditing(null); return }
      const r = await api('/addresses'); setAddresses(r.addresses); setEditing(null)
    } catch (e) { toast.error(e.message) }
  }
  const remove = async (id) => { await api(`/addresses/${id}`, { method: 'DELETE' }); setAddresses(a => a.filter(x => x.id !== id)) }
  return (
    <div>
      <div className="flex justify-end mb-4"><Button variant="outline" className="rounded-none tracking-editorial uppercase text-xs" onClick={() => setEditing({ ...empty })}><Plus className="w-3.5 h-3.5 mr-2" />Add Address</Button></div>
      <div className="grid md:grid-cols-2 gap-4">
        {addresses.map(a => (
          <div key={a.id} className="border border-border p-6">
            <div className="font-serif text-xl mb-1">{a.label || 'Address'}</div>
            <div className="text-sm text-muted-foreground">{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} {a.pincode}<br />{a.country}</div>
            <div className="flex gap-3 mt-4 text-xs tracking-editorial uppercase">
              <button className="underline" onClick={() => setEditing(a)}>Edit</button>
              <button className="underline" onClick={() => remove(a.id)}>Delete</button>
            </div>
          </div>
        ))}
        {addresses.length === 0 && <div className="text-muted-foreground text-sm py-8 col-span-2 text-center">No saved addresses.</div>}
      </div>
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="rounded-none max-w-lg">
          <DialogHeader><DialogTitle className="font-serif text-2xl">{editing?.id ? 'Edit Address' : 'Add Address'}</DialogTitle></DialogHeader>
          {editing && <div className="space-y-3">
            <Input placeholder="Label (Home, Office)" className="rounded-none" value={editing.label} onChange={e => setEditing({ ...editing, label: e.target.value })} />
            <Input placeholder="Address Line 1" className="rounded-none" value={editing.line1} onChange={e => setEditing({ ...editing, line1: e.target.value })} />
            <Input placeholder="Address Line 2" className="rounded-none" value={editing.line2} onChange={e => setEditing({ ...editing, line2: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="City" className="rounded-none" value={editing.city} onChange={e => setEditing({ ...editing, city: e.target.value })} />
              <Input placeholder="State" className="rounded-none" value={editing.state} onChange={e => setEditing({ ...editing, state: e.target.value })} />
              <Input placeholder="PIN" className="rounded-none" value={editing.pincode} onChange={e => setEditing({ ...editing, pincode: e.target.value })} />
              <Input placeholder="Country" className="rounded-none" value={editing.country} onChange={e => setEditing({ ...editing, country: e.target.value })} />
            </div>
          </div>}
          <DialogFooter><Button className="rounded-none tracking-editorial uppercase text-xs" onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CustomerEnquiries() {
  const { api, user } = useApp()
  const [inquiries, setInquiries] = useState([])
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', phone: '', subject: '', message: '' })
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try {
      const r = await api('/inquiries')
      setInquiries(r.inquiries || [])
    } catch (e) { /* ignore */ }
  }

  useEffect(() => { if (user) load() }, [user])

  const submit = async () => {
    if (!form.name || !form.email || !form.phone || !form.message) { toast.error('Please fill name, email, phone and message'); return }
    setLoading(true)
    try {
      await api('/inquiries', { method: 'POST', body: form })
      toast.success('Your enquiry has been sent')
      setForm({ name: user?.name || '', email: user?.email || '', phone: '', subject: '', message: '' })
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  if (!user) return <div className="text-sm text-muted-foreground">Please sign in to view and send enquiries.</div>

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <h3 className="font-serif text-2xl mb-4">Send an Enquiry</h3>
        <div className="space-y-3">
          <Input placeholder="Full Name" className="rounded-none h-12" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div className="grid md:grid-cols-2 gap-4">
            <Input placeholder="Email" className="rounded-none h-12" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Phone" className="rounded-none h-12" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Input placeholder="Subject" className="rounded-none h-12" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
          <Textarea placeholder="How may we assist?" rows={6} className="rounded-none" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
          <Button className="rounded-none h-12 tracking-editorial uppercase text-xs px-10" onClick={submit} disabled={loading}>{loading ? 'Sending…' : 'Send Enquiry'}</Button>
        </div>
      </div>
      <div>
        <h3 className="font-serif text-2xl mb-4">Your Enquiries</h3>
        {inquiries.length === 0
          ? <div className="text-sm text-muted-foreground">No enquiries yet.</div>
          : <div className="space-y-4">
            {inquiries.map(q => (
              <div key={q.id} className="border border-border p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{q.subject || 'Enquiry'}</div>
                    <div className="text-xs text-muted-foreground">{new Date(q.createdAt).toLocaleString()}</div>
                  </div>
                  <Badge className="rounded-none bg-accent text-accent-foreground">{q.status || 'New'}</Badge>
                </div>
                <div className="mt-3 text-sm">{q.message}</div>
                {q.response && <div className="mt-3 p-3 bg-muted text-sm">Admin: {q.response}</div>}
              </div>
            ))}
          </div>}
      </div>
    </div>
  )
}

// ---------- Admin ----------
function AdminView() {
  const { user, api, navigate, setAuth } = useApp()
  const [tab, setTab] = useState('overview')
  useEffect(() => { if (!user || user.role !== 'admin') { toast.error('Admin only'); navigate('login') } }, [user])
  if (!user || user.role !== 'admin') return null
  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-[11px] tracking-luxe uppercase text-accent mb-2">CMS · Atelier</div>
          <h1 className="font-serif text-5xl">Admin Studio</h1>
        </div>
        <button className="text-xs tracking-editorial uppercase underline flex items-center gap-2" onClick={() => { setAuth(null, null); navigate('home') }}><LogOut className="w-3.5 h-3.5" />Sign Out</button>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-auto p-0 flex-wrap">
          {['overview', 'products', 'collections', 'orders', 'clients', 'inquiries', 'feedback', 'settings', 'page-studio'].map(t => (
            <TabsTrigger key={t} value={t} className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-accent tracking-editorial uppercase text-xs px-6 py-3">{t === 'page-studio' ? 'Page Studio' : t}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="pt-8"><AdminOverview /></TabsContent>
        <TabsContent value="products" className="pt-8"><AdminProducts /></TabsContent>
        <TabsContent value="collections" className="pt-8"><AdminCollections /></TabsContent>
        <TabsContent value="orders" className="pt-8"><AdminOrders /></TabsContent>
        <TabsContent value="clients" className="pt-8"><AdminClients /></TabsContent>
        <TabsContent value="inquiries" className="pt-8"><AdminInquiries /></TabsContent>
        <TabsContent value="feedback" className="pt-8"><AdminFeedback /></TabsContent>
        <TabsContent value="settings" className="pt-8"><AdminSettings /></TabsContent>
        <TabsContent value="page-studio" className="pt-8"><AdminPageStudio /></TabsContent>
      </Tabs>
    </div>
  )
}

function StatCard({ label, value }) {
  return <div className="border border-border p-8">
    <div className="text-[11px] tracking-editorial uppercase text-muted-foreground">{label}</div>
    <div className="font-serif text-5xl mt-2">{value}</div>
  </div>
}
function AdminOverview() {
  const { api } = useApp()
  const [data, setData] = useState(null)
  useEffect(() => { api('/admin/overview').then(setData) }, [])
  if (!data) return <div className="text-muted-foreground">Loading...</div>
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Products" value={data.productCount} />
        <StatCard label="Orders" value={data.orderCount} />
        <StatCard label="New Enquiries" value={data.inquiryCount} />
        <StatCard label="Clients" value={data.userCount} />
      </div>
      {data.lowStock?.length > 0 && (
        <div className="mt-10">
          <h3 className="font-serif text-2xl mb-4">Low Stock Alerts</h3>
          <div className="space-y-2">
            {data.lowStock.map(p => (
              <div key={p.id} className="flex items-center justify-between border border-border p-4">
                <div className="flex items-center gap-3"><img src={p.images?.[0]} className="w-10 h-14 object-cover" /><span>{p.name}</span></div>
                <Badge className="rounded-none bg-destructive text-destructive-foreground">Stock: {p.stock}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AdminProducts() {
  const { api, collections } = useApp()
  const [products, setProducts] = useState([])
  const [editing, setEditing] = useState(null)
  const reload = () => api('/products').then(r => setProducts(r.products))
  useEffect(() => { reload() }, [])
  const empty = { name: '', description: '', collection: 'womenswear', price: 0, salePrice: '', shipping: 0, onSale: false, sku: '', stock: 0, images: [''], sizes: ['XS', 'S', 'M', 'L', 'XL'], colors: ['Noir', 'Ivory', 'Champagne'], material: '', care: '', sizeGuide: '', featured: false, lowStockThreshold: 3 }
  const save = async () => {
    try {
      const body = { ...editing, images: editing.images.filter(Boolean) }
      if (editing.id) await api(`/products/${editing.id}`, { method: 'PUT', body })
      else await api('/products', { method: 'POST', body })
      toast.success('Saved'); setEditing(null); reload()
    } catch (e) { toast.error(e.message) }
  }
  const remove = async (id) => { if (!confirm('Delete this product?')) return; await api(`/products/${id}`, { method: 'DELETE' }); reload() }
  return (
    <div>
      <div className="flex justify-between mb-6">
        <h3 className="font-serif text-2xl">Products ({products.length})</h3>
        <Button className="rounded-none tracking-editorial uppercase text-xs" onClick={() => setEditing({ ...empty })}><Plus className="w-3.5 h-3.5 mr-2" />New Product</Button>
      </div>
      <div className="grid gap-2">
        {products.map(p => {
          const stock = Number(p.stock) || 0
          const lowStockThreshold = Number(p.lowStockThreshold) || 3
          return (
            <div key={p.id} className="grid grid-cols-[60px_1fr_auto_auto_auto] gap-4 items-center border border-border p-3">
              <img src={p.images?.[0]} className="w-14 h-16 object-cover" />
              <div>
                <div className="font-serif text-lg">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.collection} · SKU {p.sku}</div>
              </div>
              <div className="text-sm">{money(p.price)}</div>
              <Badge className={cx('rounded-none', stock <= lowStockThreshold ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-foreground')}>Stock {stock}</Badge>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="rounded-none" onClick={() => setEditing({ ...p, images: p.images?.length ? p.images : [''] })}><Edit3 className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="outline" className="rounded-none" onClick={() => remove(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          )
        })}
      </div>
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="rounded-none max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif text-2xl">{editing?.id ? 'Edit Product' : 'New Product'}</DialogTitle></DialogHeader>
          {editing && <div className="space-y-4">
            <Input placeholder="Name" className="rounded-none" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            <Textarea placeholder="Description" rows={3} className="rounded-none" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={collections.find(c => c.slug === editing.collection)?.parentSlug || editing.collection} onValueChange={v => setEditing({ ...editing, collection: v })}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Collection" /></SelectTrigger>
                <SelectContent>{collections.filter(c => !c.parentSlug).map(c => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={collections.find(c => c.slug === editing.collection)?.parentSlug ? editing.collection : '__none__'} onValueChange={v => setEditing({ ...editing, collection: v === '__none__' ? collections.find(c => c.slug === editing.collection)?.parentSlug || editing.collection : v })}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Category (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All products in collection</SelectItem>
                  {collections.filter(c => c.parentSlug === (collections.find(parent => parent.slug === editing.collection)?.parentSlug || editing.collection)).map(c => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="SKU" className="rounded-none" value={editing.sku} onChange={e => setEditing({ ...editing, sku: e.target.value })} />
              <Input type="number" placeholder="Price (₹)" className="rounded-none" value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} />
              <Input type="number" placeholder="Sale Price (optional)" className="rounded-none" value={editing.salePrice || ''} onChange={e => setEditing({ ...editing, salePrice: e.target.value })} />
              <Input type="number" min="0" placeholder="Shipping charge (₹)" className="rounded-none" value={editing.shipping ?? 0} onChange={e => setEditing({ ...editing, shipping: e.target.value })} />
              <Input type="number" placeholder="Stock" className="rounded-none" value={editing.stock} onChange={e => setEditing({ ...editing, stock: e.target.value })} />
              <Input type="number" placeholder="Low stock threshold" className="rounded-none" value={editing.lowStockThreshold} onChange={e => setEditing({ ...editing, lowStockThreshold: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Images (URLs)</Label>
              {editing.images.map((img, i) => (
                <div key={i} className="flex gap-2 mt-2">
                  <Input className="rounded-none" value={img} onChange={e => { const a = [...editing.images]; a[i] = e.target.value; setEditing({ ...editing, images: a }) }} />
                  <Button variant="outline" size="sm" className="rounded-none" onClick={() => { const a = editing.images.filter((_, x) => x !== i); setEditing({ ...editing, images: a.length ? a : [''] }) }}><X className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="rounded-none mt-2" onClick={() => setEditing({ ...editing, images: [...editing.images, ''] })}>+ Add Image</Button>
            </div>
            <Input placeholder="Sizes (comma separated)" className="rounded-none" value={Array.isArray(editing.sizes) ? editing.sizes.join(',') : ''} onChange={e => setEditing({ ...editing, sizes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
            <Input placeholder="Colors (comma separated)" className="rounded-none" value={Array.isArray(editing.colors) ? editing.colors.join(',') : ''} onChange={e => setEditing({ ...editing, colors: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
            <Textarea placeholder="Material & Craft" rows={2} className="rounded-none" value={editing.material} onChange={e => setEditing({ ...editing, material: e.target.value })} />
            <Textarea placeholder="Care instructions" rows={2} className="rounded-none" value={editing.care} onChange={e => setEditing({ ...editing, care: e.target.value })} />
            <Textarea placeholder="Size guide for customers" rows={4} className="rounded-none" value={editing.sizeGuide || ''} onChange={e => setEditing({ ...editing, sizeGuide: e.target.value })} />
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm"><Switch checked={editing.featured} onCheckedChange={v => setEditing({ ...editing, featured: v })} /> Featured</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={editing.onSale} onCheckedChange={v => setEditing({ ...editing, onSale: v })} /> On Sale</label>
            </div>
          </div>}
          <DialogFooter><Button className="rounded-none tracking-editorial uppercase text-xs" onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AdminCollections() {
  const { api, collections, setCollections } = useApp()
  const topLevelCollections = collections.filter(collection => !collection.parentSlug)
  const [editing, setEditing] = useState(null)
  const reload = () => api('/collections').then(r => setCollections(r.collections))
  const save = async () => {
    try {
      if (editing.id) await api(`/collections/${editing.id}`, { method: 'PUT', body: editing })
      else await api('/collections', { method: 'POST', body: editing })
      toast.success('Saved'); setEditing(null); reload()
    } catch (e) { toast.error(e.message) }
  }
  const remove = async (id) => { if (!confirm('Delete?')) return; await api(`/collections/${id}`, { method: 'DELETE' }); reload() }
  return (
    <div>
      <div className="flex justify-between mb-6"><h3 className="font-serif text-2xl">Collections & Categories</h3><Button className="rounded-none tracking-editorial uppercase text-xs" onClick={() => setEditing({ name: '', slug: '', image: '', description: '', order: topLevelCollections.length + 1, parentSlug: null })}><Plus className="w-3.5 h-3.5 mr-2" />New Collection</Button></div>
      <div className="grid md:grid-cols-3 gap-4">
        {topLevelCollections.map(c => (
          <div key={c.id} className="border border-border p-4">
            <img src={c.image} className="w-full aspect-video object-cover mb-3" />
            <div className="font-serif text-xl">{c.name}</div>
            <div className="text-xs text-muted-foreground">{c.slug}</div>
            <div className="mt-4 border-t border-border pt-3">
              <div className="flex items-center justify-between mb-2"><span className="text-[11px] tracking-editorial uppercase text-muted-foreground">Categories</span><Button size="sm" variant="outline" className="rounded-none h-7 text-[10px]" onClick={() => setEditing({ name: '', slug: '', parentSlug: c.slug, image: '', description: '', order: collections.filter(child => child.parentSlug === c.slug).length + 1 })}><Plus className="w-3 h-3 mr-1" />Add</Button></div>
              <div className="space-y-1">
                {collections.filter(child => child.parentSlug === c.slug).sort((a, b) => (a.order || 0) - (b.order || 0)).map(child => <div key={child.id} className="flex items-center justify-between text-sm"><span>{child.name}</span><Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => remove(child.id)}><Trash2 className="w-3 h-3" /></Button></div>)}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" className="rounded-none" onClick={() => setEditing(c)}>Edit</Button>
              <Button size="sm" variant="outline" className="rounded-none" onClick={() => remove(c.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="rounded-none">
          <DialogHeader><DialogTitle className="font-serif text-2xl">{editing?.id ? 'Edit' : 'New'} Collection</DialogTitle></DialogHeader>
          {editing && <div className="space-y-3">
            <Input placeholder="Name" className="rounded-none" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            <Input placeholder="Slug" className="rounded-none" value={editing.slug} onChange={e => setEditing({ ...editing, slug: e.target.value })} />
            {editing.parentSlug && <div className="text-xs text-muted-foreground">Category of {topLevelCollections.find(collection => collection.slug === editing.parentSlug)?.name || editing.parentSlug}</div>}
            <Input placeholder="Image URL" className="rounded-none" value={editing.image} onChange={e => setEditing({ ...editing, image: e.target.value })} />
            <Textarea placeholder="Description" className="rounded-none" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            <Input type="number" placeholder="Order" className="rounded-none" value={editing.order} onChange={e => setEditing({ ...editing, order: e.target.value })} />
          </div>}
          <DialogFooter><Button className="rounded-none" onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AdminOrders() {
  const { api, settings, token } = useApp()
  const [orders, setOrders] = useState([])
  const [editing, setEditing] = useState(null)
  const reload = () => api('/orders').then(r => setOrders(r.orders || []))
  useEffect(() => { reload() }, [])
  const statuses = ['Enquiry Received', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled']
  const save = async () => {
    try { await api(`/orders/${editing.id}`, { method: 'PUT', body: { status: editing.status, trackingNumber: editing.trackingNumber, adminNotes: editing.adminNotes, historyNote: editing.historyNote } }); toast.success('Updated'); setEditing(null); reload() } catch (e) { toast.error(e.message) }
  }
  const remove = async (id) => {
    if (!confirm('Delete this order?')) return
    try { await api(`/orders/${id}`, { method: 'DELETE' }); toast.success('Order deleted'); reload() } catch (e) { toast.error(e.message) }
  }
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h3 className="font-serif text-2xl">All Orders ({orders.length})</h3>
        <Button variant="outline" className="rounded-none tracking-editorial uppercase text-xs" onClick={() => downloadAdminExport('orders', token).catch(e => toast.error(e.message))}><Download className="w-3.5 h-3.5 mr-2" />Export Orders</Button>
      </div>
      <div className="space-y-2">
        {orders.map(o => (
          <div key={o.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center border border-border p-4">
            <div>
              <div className="font-serif text-lg">{o.orderNumber}</div>
              <div className="text-xs text-muted-foreground">{o.customerName} · {o.customerEmail} · {new Date(o.createdAt).toLocaleDateString()}</div>
            </div>
            <div className="text-sm">{money(o.total, settings.currencySymbol)}</div>
            <Badge className="rounded-none bg-accent text-accent-foreground">{o.status}</Badge>
            <Button size="sm" variant="outline" className="rounded-none" onClick={() => setEditing({ ...o, historyNote: '' })}>Edit</Button>
            <Button size="sm" variant="outline" className="rounded-none" onClick={() => remove(o.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        ))}
        {orders.length === 0 && <div className="text-muted-foreground text-sm py-12 text-center">No orders yet.</div>}
      </div>
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="rounded-none max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif text-2xl">Order {editing?.orderNumber}</DialogTitle></DialogHeader>
          {editing && <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-[11px] tracking-editorial uppercase text-muted-foreground">Customer</div>{editing.customerName}<br />{editing.customerEmail}<br />{editing.customerPhone}</div>
              <div><div className="text-[11px] tracking-editorial uppercase text-muted-foreground">Shipping</div>{editing.shippingAddress?.line1}<br />{editing.shippingAddress?.city}, {editing.shippingAddress?.state} {editing.shippingAddress?.pincode}</div>
            </div>
            <div className="border-t border-border pt-4">
              <div className="text-[11px] tracking-editorial uppercase text-muted-foreground mb-2">Items</div>
              {editing.items?.map(it => <div key={it.key} className="text-sm">{it.name} · {it.color} · {it.size} · x{it.qty} — {money(it.price * it.qty, settings.currencySymbol)}</div>)}
            </div>
            <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
              <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Tracking Number" className="rounded-none" value={editing.trackingNumber || ''} onChange={e => setEditing({ ...editing, trackingNumber: e.target.value })} />
            <Input placeholder="History Note (optional)" className="rounded-none" value={editing.historyNote || ''} onChange={e => setEditing({ ...editing, historyNote: e.target.value })} />
            <Textarea placeholder="Admin Notes" className="rounded-none" value={editing.adminNotes || ''} onChange={e => setEditing({ ...editing, adminNotes: e.target.value })} />
          </div>}
          <DialogFooter><Button className="rounded-none" onClick={save}>Update</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AdminClients() {
  const { api, token } = useApp()
  const [clients, setClients] = useState([])
  const reload = () => api('/users').then(r => setClients(r.users || []))
  useEffect(() => { reload() }, [])
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h3 className="font-serif text-2xl">Clients ({clients.length})</h3>
        <Button variant="outline" className="rounded-none tracking-editorial uppercase text-xs" onClick={() => downloadAdminExport('clients', token).catch(e => toast.error(e.message))}><Download className="w-3.5 h-3.5 mr-2" />Export Clients</Button>
      </div>
      <div className="grid gap-2">
        {clients.map(client => (
          <div key={client.id} className="grid grid-cols-[1.2fr_1.2fr_1fr_auto] gap-4 items-center border border-border p-4">
            <div>
              <div className="font-serif text-lg">{client.name || 'Unnamed client'}</div>
              <div className="text-xs text-muted-foreground">Joined {new Date(client.createdAt).toLocaleDateString()}</div>
            </div>
            <div className="text-sm break-all">{client.email || '—'}</div>
            <div className="text-sm">{client.phone || '—'}</div>
            <Badge className="rounded-none bg-muted text-foreground">{client.role === 'admin' ? 'Admin' : 'Client'}</Badge>
          </div>
        ))}
        {clients.length === 0 && <div className="text-muted-foreground text-sm py-12 text-center">No clients yet.</div>}
      </div>
    </div>
  )
}

function AdminInquiries() {
  const { api } = useApp()
  const [items, setItems] = useState([])
  const [editing, setEditing] = useState(null)
  const reload = () => api('/inquiries').then(r => setItems((r.inquiries || []).filter(item => item.subject !== 'Website Feedback')))
  useEffect(() => { reload() }, [])
  const save = async () => {
    try { await api(`/inquiries/${editing.id}`, { method: 'PUT', body: { status: editing.status, response: editing.response } }); toast.success('Updated'); setEditing(null); reload() } catch (e) { toast.error(e.message) }
  }
  const remove = async (id) => { if (!confirm('Delete?')) return; await api(`/inquiries/${id}`, { method: 'DELETE' }); reload() }
  return (
    <div>
      <h3 className="font-serif text-2xl mb-6">Enquiries ({items.length})</h3>
      <div className="space-y-2">
        {items.map(i => (
          <div key={i.id} className="border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-serif text-lg">{i.subject}</div>
                <div className="text-xs text-muted-foreground">From {i.name} · {i.email} · {i.phone}</div>
                <p className="text-sm mt-2 whitespace-pre-wrap">{i.message}</p>
                {i.response && <p className="text-sm mt-3 border-l-2 border-accent pl-3 italic">{i.response}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge className="rounded-none">{i.status}</Badge>
                <Button size="sm" variant="outline" className="rounded-none" onClick={() => setEditing({ ...i })}>Reply</Button>
                <Button size="sm" variant="outline" className="rounded-none" onClick={() => remove(i.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-muted-foreground text-sm py-12 text-center">No enquiries.</div>}
      </div>
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="rounded-none">
          <DialogHeader><DialogTitle className="font-serif text-2xl">Reply to {editing?.name}</DialogTitle></DialogHeader>
          {editing && <div className="space-y-3">
            <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
              <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent>{['New', 'In Progress', 'Answered', 'Closed'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea placeholder="Your response" rows={5} className="rounded-none" value={editing.response || ''} onChange={e => setEditing({ ...editing, response: e.target.value })} />
          </div>}
          <DialogFooter><Button className="rounded-none" onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AdminFeedback() {
  const { api } = useApp()
  const [items, setItems] = useState([])
  const reload = () => api('/feedback').then(r => setItems(r.feedback || []))
  useEffect(() => { reload() }, [])
  const remove = async (id) => {
    if (!confirm('Delete this feedback?')) return
    try { await api(`/feedback/${id}`, { method: 'DELETE' }); reload() } catch (e) { toast.error(e.message) }
  }
  return (
    <div>
      <h3 className="font-serif text-2xl mb-2">Client Feedback ({items.length})</h3>
      <p className="text-sm text-muted-foreground mb-6">Thoughts shared by clients to help shape the YASH experience.</p>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="border border-border p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-serif text-lg">{item.name}</div>
                <div className="text-xs text-muted-foreground">{item.email} · {new Date(item.createdAt).toLocaleString()}</div>
                <p className="text-sm mt-3 whitespace-pre-wrap">{item.message}</p>
              </div>
              <Button size="sm" variant="outline" className="rounded-none" onClick={() => remove(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-muted-foreground text-sm py-12 text-center">No feedback yet.</div>}
      </div>
    </div>
  )
}

function AdminSettings() {
  const { api, settings, setSettings } = useApp()
  const [form, setForm] = useState(settings)
  useEffect(() => setForm(settings), [settings])
  const save = async () => {
    try { const r = await api('/settings', { method: 'PUT', body: form }); setSettings(r.settings); toast.success('Site content updated') } catch (e) { toast.error(e.message) }
  }
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setConcierge = (k, v) => setForm(f => ({ ...f, concierge: { ...(f.concierge || {}), [k]: v } }))
  const setNavLink = (idx, key, val) => setForm(f => ({ ...f, headerNavLinks: (f.headerNavLinks || []).map((link, i) => i === idx ? { ...link, [key]: val } : link) }))
  const addNavLink = () => setForm(f => ({ ...f, headerNavLinks: [...(f.headerNavLinks || []), { label: 'New Link', page: 'shop', visible: true }] }))
  const removeNavLink = (idx) => setForm(f => ({ ...f, headerNavLinks: (f.headerNavLinks || []).filter((_, i) => i !== idx) }))
  const setSocialLink = (idx, key, val) => setForm(f => ({ ...f, socialLinks: (f.socialLinks || []).map((link, i) => i === idx ? { ...link, [key]: val } : link) }))
  const addSocialLink = () => setForm(f => ({ ...f, socialLinks: [...(f.socialLinks || []), { label: 'Social', url: '', visible: true }] }))
  const removeSocialLink = (idx) => setForm(f => ({ ...f, socialLinks: (f.socialLinks || []).filter((_, i) => i !== idx) }))
  if (!form) return null
  return (
    <div className="max-w-3xl space-y-6">
      <h3 className="font-serif text-2xl">Website Editor</h3>
      <div className="space-y-3">
        <Label>Brand Name</Label><Input className="rounded-none" value={form.brand} onChange={e => setField('brand', e.target.value)} />
        <Label>Slogan</Label><Input className="rounded-none" value={form.slogan} onChange={e => setField('slogan', e.target.value)} />
        <Label>Logo URL</Label><Input className="rounded-none" value={form.logoUrl} onChange={e => setField('logoUrl', e.target.value)} />
        <Label>Announcement Bar</Label><Input className="rounded-none" value={form.announcement || ''} onChange={e => setField('announcement', e.target.value)} />
      </div>
      <div className="space-y-3 border-t border-border pt-6">
        <h4 className="font-serif text-xl">Hero</h4>
        <Label>Hero Title</Label><Input className="rounded-none" value={form.heroTitle} onChange={e => setField('heroTitle', e.target.value)} />
        <Label>Hero Subtitle</Label><Textarea className="rounded-none" value={form.heroSubtitle} onChange={e => setField('heroSubtitle', e.target.value)} />
        <Label>Hero Image URL</Label><Input className="rounded-none" value={form.heroImage} onChange={e => setField('heroImage', e.target.value)} />
        <Label>Hero CTA Label</Label><Input className="rounded-none" value={form.heroCtaLabel || ''} onChange={e => setField('heroCtaLabel', e.target.value)} />
      </div>
      <div className="space-y-3 border-t border-border pt-6">
        <h4 className="font-serif text-xl">About</h4>
        <Label>About Title</Label><Input className="rounded-none" value={form.aboutTitle} onChange={e => setField('aboutTitle', e.target.value)} />
        <Label>About Body</Label><Textarea rows={5} className="rounded-none" value={form.aboutBody} onChange={e => setField('aboutBody', e.target.value)} />
      </div>
      <div className="space-y-3 border-t border-border pt-6">
        <h4 className="font-serif text-xl">Lookbook</h4>
        <Label>Lookbook Title</Label><Input className="rounded-none" value={form.lookbookTitle} onChange={e => setField('lookbookTitle', e.target.value)} />
        <Label>Lookbook Subtitle</Label><Input className="rounded-none" value={form.lookbookSubtitle} onChange={e => setField('lookbookSubtitle', e.target.value)} />
        <Label>Lookbook Images (one per line)</Label>
        <Textarea rows={4} className="rounded-none" value={(form.lookbookImages || []).join('\n')} onChange={e => setField('lookbookImages', e.target.value.split('\n').filter(Boolean))} />
      </div>
      <div className="space-y-3 border-t border-border pt-6">
        <h4 className="font-serif text-xl">Concierge</h4>
        <Label>Title</Label><Input className="rounded-none" value={form.concierge?.title || ''} onChange={e => setConcierge('title', e.target.value)} />
        <Label>Subtitle</Label><Textarea className="rounded-none" value={form.concierge?.subtitle || ''} onChange={e => setConcierge('subtitle', e.target.value)} />
        <Label>Email</Label><Input className="rounded-none" value={form.concierge?.email || ''} onChange={e => setConcierge('email', e.target.value)} />
        <Label>Phone</Label><Input className="rounded-none" value={form.concierge?.phone || ''} onChange={e => setConcierge('phone', e.target.value)} />
      </div>
      <div className="space-y-3 border-t border-border pt-6">
        <h4 className="font-serif text-xl">Header Navigation</h4>
        <div className="text-xs text-muted-foreground">Choose the pages that appear in the header and mobile menu. Toggle any link off to hide it from customers.</div>
        {(form.headerNavLinks || []).map((link, idx) => (
          <div key={idx} className="border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Link {idx + 1}</Label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={link.visible !== false} onCheckedChange={v => setNavLink(idx, 'visible', v)} /> Visible</label>
            </div>
            <Input className="rounded-none" value={link.label || ''} onChange={e => setNavLink(idx, 'label', e.target.value)} placeholder="Label" />
            <div className="grid md:grid-cols-2 gap-2">
              <Input className="rounded-none" value={link.page || ''} onChange={e => setNavLink(idx, 'page', e.target.value)} placeholder="Page key (shop, about, concierge, home)" />
              <Input className="rounded-none" value={link.collection || ''} onChange={e => setNavLink(idx, 'collection', e.target.value)} placeholder="Collection slug (optional)" />
            </div>
            <div className="flex justify-end"><Button variant="outline" size="sm" className="rounded-none" onClick={() => removeNavLink(idx)}>Remove</Button></div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="rounded-none" onClick={addNavLink}>+ Add Header Link</Button>
      </div>
      <div className="space-y-3 border-t border-border pt-6">
        <h4 className="font-serif text-xl">Social Links</h4>
        <div className="text-xs text-muted-foreground">Add links that should appear in the footer for your social channels.</div>
        {(form.socialLinks || []).map((link, idx) => (
          <div key={idx} className="border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Social {idx + 1}</Label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={link.visible !== false} onCheckedChange={v => setSocialLink(idx, 'visible', v)} /> Visible</label>
            </div>
            <Input className="rounded-none" value={link.label || ''} onChange={e => setSocialLink(idx, 'label', e.target.value)} placeholder="Instagram, Facebook, X" />
            <Input className="rounded-none" value={link.url || ''} onChange={e => setSocialLink(idx, 'url', e.target.value)} placeholder="https://..." />
            <div className="flex justify-end"><Button variant="outline" size="sm" className="rounded-none" onClick={() => removeSocialLink(idx)}>Remove</Button></div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="rounded-none" onClick={addSocialLink}>+ Add Social Link</Button>
      </div>
      <div className="space-y-3 border-t border-border pt-6">
        <h4 className="font-serif text-xl">Footer</h4>
        <Label>Footer Copy</Label><Input className="rounded-none" value={form.footerCopy || ''} onChange={e => setField('footerCopy', e.target.value)} />
      </div>
      <Button className="rounded-none tracking-editorial uppercase text-xs" onClick={save}>Save All Changes</Button>
    </div>
  )
}

// ---------- Admin Page Studio (WYSIWYG Visual Editor) ----------
const SECTION_TYPES = [
  { type: 'hero-banner', label: 'Hero Banner', desc: 'Full-width image with title, subtitle and optional CTA' },
  { type: 'editorial-text', label: 'Editorial Text', desc: 'Centered or aligned text block with title and body copy' },
  { type: 'lookbook-strip', label: 'Lookbook Strip', desc: '3-image editorial strip, optionally staggered' },
  { type: 'promo-banner', label: 'Promo Banner', desc: 'Dark or light promotional banner with CTA' },
  { type: 'core-shop', label: 'Shop Product Grid', desc: 'Main product grid with sidebar filters', isCore: true },
  { type: 'core-concierge', label: 'Concierge Form', desc: 'Booking form and details', isCore: true },
]

const PAGE_DEFS = [
  { key: 'home', label: 'Home', desc: 'Main landing page' },
  { key: 'shop', label: 'Shop', desc: 'All products page' },
  { key: 'womenswear', label: 'Women', desc: 'Womenswear collection' },
  { key: 'menswear', label: 'Men', desc: 'Menswear collection' },
  { key: 'accessories', label: 'Accessories', desc: 'Accessories collection' },
  { key: 'concierge', label: 'Concierge', desc: 'Private concierge page' },
]

const DEFAULT_SECTION_CONTENT = {
  'hero-banner': { content: { label: '', title: '', subtitle: '', image: '', ctaLabel: '', ctaAction: '' }, style: { textAlign: 'center', overlayOpacity: 0.4, height: '50vh' } },
  'editorial-text': { content: { label: '', title: '', body: '' }, style: { textAlign: 'center' } },
  'lookbook-strip': { content: { images: ['', '', ''], offset: true }, style: {} },
  'promo-banner': { content: { text: '', ctaLabel: '', ctaAction: '' }, style: { bgColor: 'dark' } },
}

// Home page section definitions – map real settings fields to visual section cards
const HOME_SECTION_DEFS = [
  {
    id: 'announcement', label: 'Announcement Bar', accent: '#c8a15b',
    fields: [
      { key: 'announcement', label: 'Text', type: 'text', placeholder: 'Complimentary shipping…' },
      { key: 'announcementBg', label: 'Background Color', type: 'color', placeholder: '#141414' },
      { key: 'announcementColor', label: 'Text Color', type: 'color', placeholder: '#c8a15b' },
    ],
    preview: (s) => (
      <div style={{ background: s.announcementBg || '#141414', color: s.announcementColor || '#c8a15b', padding: '8px 12px', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', textAlign: 'center' }}>
        {s.announcement || 'Announcement text here'}
      </div>
    )
  },
  {
    id: 'hero', label: 'Hero Banner', accent: '#1a1a2e',
    fields: [
      { key: 'heroImage', label: 'Desktop Background Image URL', type: 'url', placeholder: 'https://...' },
      { key: 'heroImageMobile', label: 'Mobile Background Image URL', type: 'url', placeholder: 'https://...' },
      { key: 'heroObjectPosition', label: 'Image Focus Position', type: 'text', placeholder: 'center center' },
      { key: 'heroEyebrow', label: 'Season Label / Eyebrow', type: 'text', placeholder: 'Season 01 — Nocturne' },
      { key: 'heroTitle', label: 'Main Title', type: 'text', placeholder: 'Own Every Moment' },
      { key: 'heroSubtitle', label: 'Subtitle', type: 'textarea', placeholder: 'A curated house of quiet luxury…' },
      { key: 'heroCtaLabel', label: 'CTA Button Label', type: 'text', placeholder: 'Discover the Collection' },
      {
        key: 'heroHeight', label: 'Banner Height', type: 'select', options: [
          { value: '60vh', label: '60vh — Small' }, { value: '70vh', label: '70vh — Medium' }, { value: '80vh', label: '80vh — Large' }, { value: '92vh', label: '92vh — Full Screen' },
        ]
      },
      {
        key: 'heroTextAlign', label: 'Text Alignment', type: 'select', options: [
          { value: 'center', label: 'Center' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' },
        ]
      },
      {
        key: 'heroTextPosition', label: 'Text Vertical Position', type: 'select', options: [
          { value: 'bottom', label: 'Bottom' }, { value: 'center', label: 'Center' }, { value: 'top', label: 'Top' },
        ]
      },
      {
        key: 'heroTitleSize', label: 'Title Size', type: 'select', options: [
          { value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }, { value: 'xl', label: 'Extra Large' },
        ]
      },
      { key: 'heroOverlay', label: 'Overlay Darkness (0–1)', type: 'number', min: 0, max: 1, step: 0.1, defaultValue: 0.4 },
    ],
    preview: (s) => (
      <div style={{ position: 'relative', height: '160px', overflow: 'hidden', background: '#111' }}>
        {(s.heroImageMobile || s.heroImage) && <img src={s.heroImageMobile || s.heroImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: s.heroObjectPosition || 'center center', opacity: 0.55 }} />}
        <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${s.heroOverlay || 0.4})` }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px', textAlign: s.heroTextAlign || 'center', color: 'white' }}>
          <div style={{ fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', opacity: 0.7, marginBottom: '4px' }}>{s.heroEyebrow || 'Season 01 — Nocturne'}</div>
          <div style={{ fontFamily: 'Georgia,serif', fontSize: '22px', lineHeight: 1.1, fontWeight: 300, marginBottom: '6px' }}>{s.heroTitle || 'Own Every Moment'}</div>
          <div style={{ fontSize: '8px', opacity: 0.7, marginBottom: '8px', maxWidth: '200px', margin: s.heroTextAlign === 'center' ? '0 auto 8px' : '0 0 8px' }}>{s.heroSubtitle || ''}</div>
          <div style={{ display: 'inline-block', background: 'white', color: '#111', fontSize: '7px', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '5px 14px' }}>{s.heroCtaLabel || 'Discover the Collection'}</div>
        </div>
      </div>
    )
  },
  {
    id: 'collections', label: 'Collections Grid', accent: '#8b7b5a',
    fields: [
      { key: 'collectionsEyebrow', label: 'Eyebrow Label', type: 'text', placeholder: 'Curated Collections' },
      { key: 'collectionsTitle', label: 'Section Title', type: 'text', placeholder: 'A house, quietly assembled.' },
      { key: 'collectionsImages', label: 'Images (one URL per line, overrides defaults)', type: 'textarea' },
      {
        key: 'collectionsColumns', label: 'Grid Columns', type: 'select', options: [
          { value: '2', label: '2 Columns' }, { value: '3', label: '3 Columns' }, { value: '4', label: '4 Columns' },
        ]
      },
      {
        key: 'collectionsAspect', label: 'Image Aspect Ratio', type: 'select', options: [
          { value: '3/4', label: 'Portrait (3:4)' }, { value: '1/1', label: 'Square (1:1)' }, { value: '4/3', label: 'Landscape (4:3)' }, { value: '16/9', label: 'Widescreen (16:9)' }, { value: 'auto', label: 'Original Size' },
        ]
      },
    ],
    preview: (s, collections) => {
      const overrides = (s.collectionsImages || '').split('\n').map(x => x.trim()).filter(Boolean)
      return (
        <div style={{ background: '#f5efe6', padding: '16px' }}>
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '8px', letterSpacing: '0.3em', color: '#c8a15b', textTransform: 'uppercase', marginBottom: '4px' }}>{s.collectionsEyebrow || 'Curated Collections'}</div>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: '14px' }}>{s.collectionsTitle || 'A house, quietly assembled.'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${s.collectionsColumns || 3},1fr)`, gap: '6px' }}>
            {(collections || []).slice(0, parseInt(s.collectionsColumns || 3)).map((c, i) => {
              const imgUrl = overrides[i] || c.image
              return (
                <div key={i} style={{ background: '#ddd', aspectRatio: s.collectionsAspect || '3/4', position: 'relative', overflow: 'hidden' }}>
                  {imgUrl && <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.4)', padding: '4px', color: 'white', fontSize: '7px', fontFamily: 'Georgia,serif' }}>{c.name}</div>
                </div>
              )
            })}
            {!(collections?.length) && [0, 1, 2].map(i => <div key={i} style={{ background: '#ddd', aspectRatio: s.collectionsAspect || '3/4' }} />)}
          </div>
        </div>
      )
    }
  },
  {
    id: 'featured', label: 'Featured Products', accent: '#4a5568',
    fields: [
      { key: 'featuredEyebrow', label: 'Eyebrow Label', type: 'text', placeholder: 'The Edit' },
      { key: 'featuredTitle', label: 'Section Title', type: 'text', placeholder: 'Signature Pieces' },
      { key: 'featuredImages', label: 'Images (one URL per line, overrides defaults)', type: 'textarea' },
      {
        key: 'featuredColumns', label: 'Product Columns', type: 'select', options: [
          { value: '2', label: '2 Columns' }, { value: '3', label: '3 Columns' }, { value: '4', label: '4 Columns' },
        ]
      },
      {
        key: 'featuredBg', label: 'Background Style', type: 'select', options: [
          { value: 'muted', label: 'Muted Beige' }, { value: 'none', label: 'White' }, { value: 'dark', label: 'Dark' },
        ]
      },
      {
        key: 'featuredAspect', label: 'Image Aspect Ratio', type: 'select', options: [
          { value: '3/4', label: 'Portrait (3:4)' }, { value: '1/1', label: 'Square (1:1)' }, { value: '4/3', label: 'Landscape (4:3)' }, { value: 'auto', label: 'Original Size' },
        ]
      },
    ],
    preview: (s, collections, featured) => {
      const overrides = (s.featuredImages || '').split('\n').map(x => x.trim()).filter(Boolean)
      const items = featured?.length ? featured.slice(0, parseInt(s.featuredColumns || 4)) : [1, 2, 3, 4]
      return (
        <div style={{ background: s.featuredBg === 'dark' ? '#111' : s.featuredBg === 'muted' ? '#f5efe6' : 'white', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '8px', letterSpacing: '0.3em', color: s.featuredBg === 'dark' ? '#c8a15b' : '#c8a15b', textTransform: 'uppercase', marginBottom: '4px' }}>{s.featuredEyebrow || 'The Edit'}</div>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: '14px', color: s.featuredBg === 'dark' ? 'white' : '#111' }}>{s.featuredTitle || 'Signature Pieces'}</div>
            </div>
            <div style={{ fontSize: '7px', letterSpacing: '0.15em', textTransform: 'uppercase', color: s.featuredBg === 'dark' ? 'white' : '#111' }}>View All →</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${s.featuredColumns || 4},1fr)`, gap: '6px' }}>
            {items.map((p, i) => {
              const imgUrl = overrides[i] || (p.images?.[0])
              return (
                <div key={i} style={{ background: s.featuredBg === 'dark' ? '#333' : '#ccc', aspectRatio: s.featuredAspect || '3/4', borderRadius: '1px', position: 'relative', overflow: 'hidden' }}>
                  {imgUrl && <img src={imgUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
              )
            })}
          </div>
        </div>
      )
    }
  },
  {
    id: 'lookbook', label: 'Lookbook Strip', accent: '#6b7280',
    fields: [
      { key: 'lookbookSubtitle', label: 'Eyebrow Label', type: 'text', placeholder: 'The Archive' },
      { key: 'lookbookTitle', label: 'Section Title', type: 'text', placeholder: 'Nocturne' },
      { key: 'lookbookImages', label: 'Images (one URL per line)', type: 'textarea-list', placeholder: 'https://...' },
      {
        key: 'lookbookStagger', label: 'Stagger Layout', type: 'select', options: [
          { value: 'true', label: 'Yes — Middle image offset' }, { value: 'false', label: 'No — All aligned' },
        ]
      },
      {
        key: 'lookbookGap', label: 'Image Gap', type: 'select', options: [
          { value: 'none', label: 'None' }, { value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' },
        ]
      },
    ],
    preview: (s) => (
      <div style={{ background: '#f5efe6', padding: '16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '8px', color: '#c8a15b', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '4px' }}>{s.lookbookSubtitle || 'Lookbook'}</div>
          <div style={{ fontFamily: 'Georgia,serif', fontSize: '14px' }}>{s.lookbookTitle || 'Nocturne'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: s.lookbookGap === 'lg' ? '12px' : s.lookbookGap === 'md' ? '8px' : '4px', alignItems: 'start' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ marginTop: (s.lookbookStagger !== 'false' && i === 1) ? '16px' : 0, background: '#ccc', aspectRatio: '3/4', overflow: 'hidden' }}>
              {(s.lookbookImages || [])[i] && <img src={s.lookbookImages[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
          ))}
        </div>
      </div>
    )
  },
  {
    id: 'about', label: 'About / Maison', accent: '#141414',
    fields: [
      { key: 'aboutEyebrow', label: 'Eyebrow Label', type: 'text', placeholder: 'Maison' },
      { key: 'aboutTitle', label: 'Title', type: 'text', placeholder: 'The House of YASH' },
      { key: 'aboutBody', label: 'Body Text', type: 'textarea', placeholder: 'Our story…' },
      {
        key: 'aboutBg', label: 'Background Style', type: 'select', options: [
          { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light Muted' },
        ]
      },
      {
        key: 'aboutPadding', label: 'Vertical Padding', type: 'select', options: [
          { value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' },
        ]
      },
    ],
    preview: (s) => {
      const bg = s.aboutBg === 'light' ? '#f0ebe3' : '#141414'
      const fg = s.aboutBg === 'light' ? '#141414' : '#fff'
      return (
        <div style={{ background: bg, color: fg, padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '8px', color: '#c8a15b', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '6px' }}>{s.aboutEyebrow || 'Maison'}</div>
          <div style={{ fontFamily: 'Georgia,serif', fontSize: '15px', marginBottom: '8px' }}>{s.aboutTitle || 'The House'}</div>
          <div style={{ width: '40px', height: '1px', background: 'linear-gradient(90deg,transparent,#c8a15b,transparent)', margin: '0 auto 8px' }} />
          <div style={{ fontSize: '8px', opacity: 0.7, lineHeight: 1.6, maxWidth: '220px', margin: '0 auto' }}>{(s.aboutBody || '').slice(0, 100)}{s.aboutBody?.length > 100 ? '…' : ''}</div>
        </div>
      )
    }
  },
  {
    id: 'concierge-cta', label: 'Concierge CTA', accent: '#c8a15b',
    fields: [
      { key: 'conciergeHomeCta', label: 'Headline', type: 'text', placeholder: 'Bespoke, on request.' },
      { key: 'conciergeCtaLabel', label: 'CTA Button Label', type: 'text', placeholder: 'Request a Consultation' },
      {
        key: 'conciergeCtaBg', label: 'Background Style', type: 'select', options: [
          { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' },
        ]
      },
    ],
    preview: (s) => {
      const bg = s.conciergeCtaBg === 'dark' ? '#141414' : '#f5efe6'
      const fg = s.conciergeCtaBg === 'dark' ? '#fff' : 'inherit'
      return (
        <div style={{ background: bg, color: fg, padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '8px', color: '#c8a15b', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '6px' }}>{s.concierge?.title || 'Concierge'}</div>
          <div style={{ fontFamily: 'Georgia,serif', fontSize: '15px', marginBottom: '8px' }}>{s.conciergeHomeCta || 'Bespoke, on request.'}</div>
          <div style={{ display: 'inline-block', border: `1px solid ${s.conciergeCtaBg === 'dark' ? '#fff' : '#141414'}`, color: fg, fontSize: '7px', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '5px 14px' }}>{s.conciergeCtaLabel || 'Request a Consultation'}</div>
        </div>
      )
    }
  },
  {
    id: 'feedback', label: 'Feedback Invitation', accent: '#6b7280',
    fields: [
      { key: 'feedbackEyebrow', label: 'Eyebrow Label', type: 'text', placeholder: 'Your voice, at the heart of the house' },
      { key: 'feedbackTitle', label: 'Headline', type: 'text', placeholder: 'Help us shape what comes next.' },
      { key: 'feedbackBody', label: 'Body Text', type: 'textarea', placeholder: 'Every thoughtful note helps us refine the YASH experience…' },
      { key: 'feedbackCtaLabel', label: 'Button Label', type: 'text', placeholder: 'Share your feedback' },
    ],
    preview: (s) => (
      <div style={{ borderTop: '1px solid #d8d0c4', padding: '20px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '8px', color: '#c8a15b', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '6px' }}>{s.feedbackEyebrow || 'Your voice, at the heart of the house'}</div>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: '15px', marginBottom: '6px' }}>{s.feedbackTitle || 'Help us shape what comes next.'}</div>
        <div style={{ color: '#6b7280', fontSize: '8px', lineHeight: 1.5, margin: '0 auto 10px', maxWidth: '240px' }}>{s.feedbackBody || 'Every thoughtful note helps us refine the YASH experience.'}</div>
        <div style={{ display: 'inline-block', border: '1px solid #141414', fontSize: '7px', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '5px 14px' }}>{s.feedbackCtaLabel || 'Share your feedback'}</div>
      </div>
    )
  },
]

function AdminPageStudio() {
  const { api, settings, setSettings, collections } = useApp()
  const [selectedPage, setSelectedPage] = useState('home')
  const [layouts, setLayouts] = useState(() => settings?.pageLayouts || {})
  const [localSettings, setLocalSettings] = useState(() => ({ ...settings }))
  const [saving, setSaving] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState('hero')
  const [editingSection, setEditingSection] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // --- Drag-and-drop state ---
  const [dragIdx, setDragIdx] = useState(null)
  const [dropIdx, setDropIdx] = useState(null)

  // --- Home section order & visibility ---
  const [homeSectionOrder, setHomeSectionOrder] = useState(() => settings?.homeSectionOrder || DEFAULT_HOME_ORDER)
  const [homeSectionVisibility, setHomeSectionVisibility] = useState(() => settings?.homeSectionVisibility || {})

  // --- Fetched data for previewing live components ---
  const [featured, setFeatured] = useState([])
  useEffect(() => { api('/products?featured=true').then(r => setFeatured(r.products.slice(0, 4))).catch(() => { }) }, [api])

  useEffect(() => setLocalSettings({ ...settings }), [settings])
  useEffect(() => { if (settings?.homeSectionOrder) setHomeSectionOrder(settings.homeSectionOrder) }, [settings])
  useEffect(() => { if (settings?.homeSectionVisibility) setHomeSectionVisibility(settings.homeSectionVisibility) }, [settings])

  // ---- HOME PAGE SECTION HANDLERS ----
  const selectedHomeDef = HOME_SECTION_DEFS.find(d => d.id === selectedSectionId)
  const setHomeField = (key, val) => setLocalSettings(s => ({ ...s, [key]: val }))

  const orderedHomeDefs = homeSectionOrder
    .map(id => HOME_SECTION_DEFS.find(d => d.id === id))
    .filter(Boolean)
  // Include any new defs not yet in order
  const missingDefs = HOME_SECTION_DEFS.filter(d => !homeSectionOrder.includes(d.id))
  const allOrderedDefs = [...orderedHomeDefs, ...missingDefs]

  const toggleHomeVisibility = (id) => {
    setHomeSectionVisibility(v => ({ ...v, [id]: v[id] === false ? true : false }))
  }

  // --- Drag handlers for home sections ---
  const handleDragStart = (e, idx) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', idx)
  }
  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (idx !== dragIdx) setDropIdx(idx)
  }
  const handleDragEnd = () => {
    if (dragIdx !== null && dropIdx !== null && dragIdx !== dropIdx) {
      const newOrder = [...homeSectionOrder]
      const [moved] = newOrder.splice(dragIdx, 1)
      newOrder.splice(dropIdx, 0, moved)
      setHomeSectionOrder(newOrder)
    }
    setDragIdx(null)
    setDropIdx(null)
  }

  const handleDragEndLayouts = () => {
    if (dragIdx !== null && dropIdx !== null && dragIdx !== dropIdx) {
      const newSections = getCurrentSections()
      const [moved] = newSections.splice(dragIdx, 1)
      newSections.splice(dropIdx, 0, moved)
      updateSections(newSections)
    }
    setDragIdx(null)
    setDropIdx(null)
  }

  const saveHomeSection = async () => {
    setSaving(true)
    try {
      const body = { homeSectionOrder, homeSectionVisibility }
        ; (selectedHomeDef?.fields || []).forEach(f => { body[f.key] = localSettings[f.key] })
      const r = await api('/settings', { method: 'PUT', body })
      setSettings(r.settings)
      setLocalSettings({ ...r.settings })
      toast.success('Section saved!')
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  // ---- LAYOUT PAGE SECTION HANDLERS ----
  const getCurrentSections = useCallback(() => {
    let sects = layouts[selectedPage]?.sections || []
    const coreType = selectedPage === 'concierge' ? 'core-concierge' : (['shop', 'womenswear', 'menswear', 'accessories'].includes(selectedPage) ? 'core-shop' : null)

    if (coreType && !sects.find(s => s.type === coreType)) {
      sects = [...sects, { id: `core-${selectedPage}`, type: coreType, visible: true, order: 999 }]
    }
    return [...sects].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [layouts, selectedPage])

  const updateSections = (newSections) => {
    setLayouts(l => ({ ...l, [selectedPage]: { sections: newSections.map((s, i) => ({ ...s, order: i })) } }))
  }

  const moveSection = (idx, dir) => {
    const sections = getCurrentSections()
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= sections.length) return
    const copy = [...sections]
      ;[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
    updateSections(copy)
  }

  const toggleVisible = (id) => {
    updateSections(getCurrentSections().map(s => s.id === id ? { ...s, visible: !s.visible } : s))
  }

  const deleteSection = (id) => {
    if (!confirm('Remove this section from the page?')) return
    updateSections(getCurrentSections().filter(s => s.id !== id))
  }

  const addSection = (type) => {
    const id = `${selectedPage}-${type}-${Date.now()}`
    const defaults = DEFAULT_SECTION_CONTENT[type] || { content: {}, style: {} }
    const sections = getCurrentSections()
    const newSection = { id, type, visible: true, order: sections.length, ...defaults }
    updateSections([...sections, newSection])
    setEditingSection({ ...newSection })
    setShowAddModal(false)
  }

  const saveSection = (updated) => {
    updateSections(getCurrentSections().map(s => s.id === updated.id ? updated : s))
    setEditingSection(null)
  }

  const saveLayouts = async () => {
    setSaving(true)
    try {
      const r = await api('/settings', { method: 'PUT', body: { pageLayouts: layouts } })
      setSettings(r.settings)
      toast.success('Page layouts saved!')
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  const isHome = selectedPage === 'home'
  const sections = isHome ? [] : getCurrentSections()

  return (
    <div>
      {/* Studio Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h3 className="font-serif text-3xl">Page Studio</h3>
          <p className="text-sm text-muted-foreground mt-1">Select a page and section to visually edit its content. Changes save to the database instantly.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => window.open('http://localhost:3000', '_blank')} className="rounded-none tracking-editorial uppercase text-xs h-9 gap-2">
            <ArrowRight className="w-3.5 h-3.5" />Preview Live
          </Button>
          {isHome
            ? <Button onClick={saveHomeSection} disabled={saving} className="rounded-none tracking-editorial uppercase text-xs h-9 px-6">{saving ? 'Saving…' : 'Save Section'}</Button>
            : <Button onClick={saveLayouts} disabled={saving} className="rounded-none tracking-editorial uppercase text-xs h-9 px-6">{saving ? 'Saving…' : 'Save Layouts'}</Button>
          }
        </div>
      </div>

      <div className="grid grid-cols-[180px_1fr_300px] gap-4 mt-2">

        {/* ---- Column 1: Page Selector ---- */}
        <div>
          <div className="text-[10px] tracking-editorial uppercase text-muted-foreground mb-2 px-1">Pages</div>
          <div className="space-y-0.5">
            {PAGE_DEFS.map(p => (
              <button key={p.key} onClick={() => { setSelectedPage(p.key); setSelectedSectionId(p.key === 'home' ? 'hero' : null) }}
                className={cx('w-full text-left px-3 py-2.5 text-sm transition-all rounded-sm', selectedPage === p.key ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
                {p.label}
                <span className="block text-[10px] opacity-60 mt-0.5">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ---- Column 2: Visual Canvas ---- */}
        <div className="min-h-0">
          <div className="text-[10px] tracking-editorial uppercase text-muted-foreground mb-2">Canvas — drag to reorder · click to edit</div>
          <div className="border border-border overflow-hidden" style={{ borderRadius: '2px' }}>
            {isHome ? (
              <div>
                {allOrderedDefs.map((def, idx) => {
                  const isHidden = homeSectionVisibility[def.id] === false
                  const isSelected = selectedSectionId === def.id
                  const isDragging = dragIdx === idx
                  const isDropTarget = dropIdx === idx
                  return (
                    <div key={def.id}>
                      {/* Drop indicator line */}
                      {isDropTarget && dragIdx !== null && dragIdx !== idx && (
                        <div style={{ height: '3px', background: '#c8a15b', margin: '0 8px', borderRadius: '2px', transition: 'all 0.15s ease' }} />
                      )}
                      <div
                        draggable
                        onDragStart={e => handleDragStart(e, idx)}
                        onDragOver={e => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedSectionId(def.id)}
                        className={cx(
                          'relative group transition-all cursor-pointer border-b border-border',
                          isSelected && 'ring-2 ring-inset ring-accent',
                          !isSelected && 'hover:ring-1 hover:ring-inset hover:ring-accent/40',
                          isDragging && 'opacity-40 scale-[0.98]',
                          isHidden && 'opacity-30',
                        )}
                        style={{ transition: 'opacity 0.2s, transform 0.2s' }}
                      >
                        {/* Drag handle + label overlay */}
                        <div className="absolute top-0 left-0 bottom-0 z-10 flex items-center pl-1.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ cursor: 'grab' }}>
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                        </div>
                        {/* Section type badge */}
                        <div className="absolute top-2 left-8 z-10">
                          <span style={{ background: def.accent || '#333' }} className="text-white text-[9px] tracking-editorial uppercase px-2 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">{def.label}</span>
                        </div>
                        {/* Edit indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-10 z-10 bg-accent text-accent-foreground text-[9px] tracking-editorial uppercase px-2 py-0.5">Editing</div>
                        )}
                        {/* Visibility toggle */}
                        <button
                          onClick={e => { e.stopPropagation(); toggleHomeVisibility(def.id) }}
                          className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-sm hover:bg-black/10 transition-colors"
                          title={isHidden ? 'Show section' : 'Hide section'}
                        >
                          {isHidden ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                        {/* Visual preview */}
                        <div className="pointer-events-none">
                          {def.preview(localSettings, collections, featured)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              // Other pages: show custom sections + add button
              <div>
                <div className="bg-muted/30 p-3 border-b border-border">
                  <div className="text-xs text-muted-foreground">Sections added here appear above the main product/content area of the <strong>{PAGE_DEFS.find(p => p.key === selectedPage)?.label}</strong> page.</div>
                </div>
                {sections.length === 0 && (
                  <div className="py-16 text-center text-muted-foreground">
                    <div className="text-sm mb-3">No custom sections yet</div>
                    <Button variant="outline" onClick={() => setShowAddModal(true)} className="rounded-none text-xs"><Plus className="w-3.5 h-3.5 mr-1.5" />Add Section</Button>
                  </div>
                )}
                <div className="">
                  {sections.map((s, idx) => {
                    const typeDef = SECTION_TYPES.find(t => t.type === s.type)
                    const isSelected = selectedSectionId === s.id
                    const isHidden = !s.visible
                    const isDragging = dragIdx === idx
                    const isDropTarget = dropIdx === idx
                    return (
                      <div key={s.id}>
                        {/* Drop indicator line */}
                        {isDropTarget && dragIdx !== null && dragIdx !== idx && (
                          <div style={{ height: '3px', background: '#c8a15b', margin: '0 8px', borderRadius: '2px', transition: 'all 0.15s ease' }} />
                        )}
                        <div
                          draggable
                          onDragStart={e => handleDragStart(e, idx)}
                          onDragOver={e => handleDragOver(e, idx)}
                          onDragEnd={handleDragEndLayouts}
                          onClick={() => setSelectedSectionId(s.id)}
                          className={cx(
                            'relative group transition-all cursor-pointer border-b border-border bg-background',
                            isSelected && 'ring-2 ring-inset ring-accent',
                            !isSelected && 'hover:ring-1 hover:ring-inset hover:ring-accent/40',
                            isDragging && 'opacity-40 scale-[0.98]',
                            isHidden && 'opacity-30',
                          )}
                          style={{ transition: 'opacity 0.2s, transform 0.2s' }}
                        >
                          {/* Drag handle & Actions overlay */}
                          <div className={cx(
                            "absolute left-0 top-0 bottom-0 w-8 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-grab active:cursor-grabbing",
                            isSelected && "opacity-100"
                          )}>
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                          </div>

                          {/* Top right actions */}
                          <div className={cx(
                            "absolute right-2 top-2 z-20 flex gap-1 transition-opacity",
                            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}>
                            <button onClick={e => { e.stopPropagation(); toggleVisible(s.id) }} className="w-7 h-7 flex items-center justify-center bg-background/80 backdrop-blur border border-border shadow-sm rounded-sm hover:bg-muted" title="Toggle Visibility">
                              {isHidden ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                            </button>
                            {!typeDef?.isCore && (
                              <button onClick={e => { e.stopPropagation(); deleteSection(s.id) }} className="w-7 h-7 flex items-center justify-center bg-background/80 backdrop-blur border border-border shadow-sm rounded-sm hover:bg-muted text-destructive" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Badge */}
                          <div className={cx(
                            "absolute left-2 top-2 z-20 transition-opacity",
                            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}>
                            <Badge className={cx("text-[9px] uppercase tracking-wider rounded-none border-none", typeDef?.isCore ? "bg-muted-foreground text-background" : "bg-accent text-accent-foreground")}>
                              {typeDef?.label || s.type}
                            </Badge>
                          </div>

                          {/* Visual preview */}
                          <div className="pointer-events-none relative overflow-hidden" style={{ minHeight: '100px' }}>
                            <div className="absolute inset-0 bg-transparent z-10" />
                            <PageSection section={{ ...s, visible: true }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {sections.length > 0 && (
                  <div className="p-3 border-t border-dashed border-border bg-muted/10">
                    <Button variant="outline" onClick={() => setShowAddModal(true)} className="w-full rounded-none text-xs tracking-editorial uppercase h-8">
                      <Plus className="w-3.5 h-3.5 mr-1.5" />Add Another Section
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ---- Column 3: Property Editor Panel ---- */}
        <div>
          <div className="text-[10px] tracking-editorial uppercase text-muted-foreground mb-2">Properties</div>
          <div className="border border-border p-5 sticky top-4 max-h-[80vh] overflow-y-auto" style={{ borderRadius: '2px' }}>
            {isHome && selectedHomeDef ? (
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-2 h-2 rounded-sm" style={{ background: selectedHomeDef.accent }} />
                  <h4 className="font-serif text-xl">{selectedHomeDef.label}</h4>
                </div>
                <div className="space-y-4">
                  {selectedHomeDef.fields.map(f => (
                    <div key={f.key}>
                      <Label className="text-[10px] tracking-editorial uppercase text-muted-foreground block mb-1.5">{f.label}</Label>
                      {f.type === 'select' ? (
                        <Select value={String(localSettings[f.key] || (f.options && f.options[0]?.value) || '')} onValueChange={v => setHomeField(f.key, v)}>
                          <SelectTrigger className="rounded-none text-sm h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{(f.options || []).map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : f.type === 'number' ? (
                        <Input type="number" min={f.min} max={f.max} step={f.step} className="rounded-none text-sm h-9" value={localSettings[f.key] ?? f.defaultValue ?? ''} onChange={e => setHomeField(f.key, e.target.value)} placeholder={f.placeholder} />
                      ) : f.type === 'color' ? (
                        <div className="flex gap-2 items-center">
                          <input type="color" value={localSettings[f.key] || f.placeholder || '#000000'} onChange={e => setHomeField(f.key, e.target.value)} className="w-8 h-8 border border-border cursor-pointer rounded-none p-0" />
                          <Input className="rounded-none text-sm h-9 flex-1 font-mono text-xs" value={localSettings[f.key] || ''} onChange={e => setHomeField(f.key, e.target.value)} placeholder={f.placeholder} />
                        </div>
                      ) : f.type === 'textarea' ? (
                        <Textarea rows={4} className="rounded-none text-sm" value={localSettings[f.key] || ''} onChange={e => setHomeField(f.key, e.target.value)} placeholder={f.placeholder} />
                      ) : f.type === 'textarea-list' ? (
                        <Textarea rows={4} className="rounded-none text-sm font-mono text-xs" value={(localSettings[f.key] || []).join('\n')} onChange={e => setHomeField(f.key, e.target.value.split('\n').filter(Boolean))} placeholder={f.placeholder} />
                      ) : (
                        <Input className="rounded-none text-sm h-9" value={localSettings[f.key] || ''} onChange={e => setHomeField(f.key, e.target.value)} placeholder={f.placeholder} />
                      )}
                      {f.type === 'url' && localSettings[f.key] && (
                        <div className="mt-2 border border-border overflow-hidden" style={{ maxHeight: '80px' }}>
                          <img src={localSettings[f.key]} alt="" className="w-full object-cover" style={{ maxHeight: '80px' }} onError={e => e.target.style.display = 'none'} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="pt-5 border-t border-border mt-5">
                  <Button onClick={saveHomeSection} disabled={saving} className="w-full rounded-none tracking-editorial uppercase text-xs h-9">
                    {saving ? 'Saving…' : `Save ${selectedHomeDef.label}`}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center mt-2">Changes persist to the database immediately.</p>
                </div>
              </div>
            ) : !isHome && selectedSectionId ? (() => {
              const sec = sections.find(s => s.id === selectedSectionId)
              if (!sec) return <div className="text-muted-foreground text-sm py-8 text-center">Select a section to edit</div>
              return (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <Badge className="rounded-none bg-accent text-accent-foreground text-[10px]">{SECTION_TYPES.find(t => t.type === sec.type)?.label}</Badge>
                  </div>
                  <SectionEditor section={sec} onChange={updated => updateSections(sections.map(s => s.id === updated.id ? updated : s))} />
                  <div className="pt-5 border-t border-border mt-5">
                    <Button onClick={saveLayouts} disabled={saving} className="w-full rounded-none tracking-editorial uppercase text-xs h-9">
                      {saving ? 'Saving…' : 'Save Layout'}
                    </Button>
                  </div>
                </div>
              )
            })()
              : (
                <div className="py-12 text-center text-muted-foreground">
                  <div className="text-4xl mb-3">←</div>
                  <div className="text-sm">Click any section in the canvas to edit its content</div>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Add Section Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="rounded-none max-w-lg">
          <DialogHeader><DialogTitle className="font-serif text-2xl">Add a Section</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3 mt-2">
            {SECTION_TYPES.map(st => (
              <button key={st.type} onClick={() => addSection(st.type)}
                className="border border-border p-4 text-left hover:border-accent hover:bg-accent/5 transition-all">
                <div className="font-medium text-sm">{st.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{st.desc}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SectionEditor({ section, onChange }) {
  const update = (patch) => onChange({ ...section, ...patch })
  const setContent = (k, v) => update({ content: { ...section.content, [k]: v } })
  const setStyle = (k, v) => update({ style: { ...section.style, [k]: v } })
  const c = section.content || {}
  const st = section.style || {}

  if (section.type === 'core-shop') return (
    <div className="space-y-4">
      <div><Label>Eyebrow</Label><Input value={c.eyebrow || ''} onChange={e => setContent('eyebrow', e.target.value)} placeholder="The Boutique" /></div>
      <div><Label>Custom Title (optional)</Label><Input value={c.title || ''} onChange={e => setContent('title', e.target.value)} placeholder="Shop All" /></div>
      <div><Label>Product Image Aspect Ratio</Label>
        <Select value={c.aspectRatio || '3/4'} onValueChange={v => setContent('aspectRatio', v)}>
          <SelectTrigger className="mt-1 rounded-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3/4">Portrait (3:4)</SelectItem>
            <SelectItem value="1/1">Square (1:1)</SelectItem>
            <SelectItem value="4/3">Landscape (4:3)</SelectItem>
            <SelectItem value="auto">Original Size</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground mt-4">The main product grid layout is managed automatically.</p>
    </div>
  )
  if (section.type === 'core-concierge') return (
    <div className="space-y-4">
      <div><Label>Form Title</Label><Input value={c.title || ''} onChange={e => setContent('title', e.target.value)} placeholder="Private Enquiry" /></div>
      <div><Label>Form Subtitle</Label><Input value={c.subtitle || ''} onChange={e => setContent('subtitle', e.target.value)} placeholder="Bespoke, on request" /></div>
      <div><Label>Submit Button</Label><Input value={c.ctaLabel || ''} onChange={e => setContent('ctaLabel', e.target.value)} placeholder="Send Enquiry" /></div>
    </div>
  )

  if (section.type === 'hero-banner') return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-2 gap-4">
        <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">Eyebrow Label</Label><Input className="rounded-none mt-1" value={c.label || ''} onChange={e => setContent('label', e.target.value)} placeholder="e.g. The Collection" /></div>
        <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">Height</Label>
          <Select value={st.height || '50vh'} onValueChange={v => setStyle('height', v)}>
            <SelectTrigger className="rounded-none mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['30vh', '40vh', '50vh', '60vh', '70vh', '80vh', '92vh'].map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">Title</Label><Input className="rounded-none mt-1" value={c.title || ''} onChange={e => setContent('title', e.target.value)} placeholder="Main heading" /></div>
      <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">Subtitle</Label><Input className="rounded-none mt-1" value={c.subtitle || ''} onChange={e => setContent('subtitle', e.target.value)} placeholder="Supporting text" /></div>
      <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">Background Image URL</Label><Input className="rounded-none mt-1" value={c.image || ''} onChange={e => setContent('image', e.target.value)} placeholder="https://..." /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">CTA Button Label</Label><Input className="rounded-none mt-1" value={c.ctaLabel || ''} onChange={e => setContent('ctaLabel', e.target.value)} placeholder="e.g. Shop Now" /></div>
        <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">CTA Action (page name)</Label><Input className="rounded-none mt-1" value={c.ctaAction || ''} onChange={e => setContent('ctaAction', e.target.value)} placeholder="e.g. shop" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">Text Align</Label>
          <Select value={st.textAlign || 'center'} onValueChange={v => setStyle('textAlign', v)}>
            <SelectTrigger className="rounded-none mt-1"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">Overlay Opacity (0–1)</Label><Input type="number" min="0" max="1" step="0.05" className="rounded-none mt-1" value={st.overlayOpacity ?? 0.4} onChange={e => setStyle('overlayOpacity', parseFloat(e.target.value))} /></div>
      </div>
    </div>
  )

  if (section.type === 'editorial-text') return (
    <div className="space-y-4 mt-2">
      <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">Eyebrow Label</Label><Input className="rounded-none mt-1" value={c.label || ''} onChange={e => setContent('label', e.target.value)} placeholder="e.g. Maison" /></div>
      <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">Title</Label><Input className="rounded-none mt-1" value={c.title || ''} onChange={e => setContent('title', e.target.value)} placeholder="Section heading" /></div>
      <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">Body Copy</Label><Textarea rows={5} className="rounded-none mt-1" value={c.body || ''} onChange={e => setContent('body', e.target.value)} placeholder="Paragraph text…" /></div>
      <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">Text Align</Label>
        <Select value={st.textAlign || 'center'} onValueChange={v => setStyle('textAlign', v)}>
          <SelectTrigger className="rounded-none mt-1"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
        </Select>
      </div>
    </div>
  )

  if (section.type === 'lookbook-strip') return (
    <div className="space-y-4 mt-2">
      <div className="text-xs text-muted-foreground">Add up to 3 image URLs for the editorial strip.</div>
      {[0, 1, 2].map(i => (
        <div key={i}><Label className="text-xs tracking-editorial uppercase text-muted-foreground">Image {i + 1} URL</Label>
          <Input className="rounded-none mt-1" value={(c.images || [])[i] || ''}
            onChange={e => { const imgs = [...(c.images || ['', '', ''])]; imgs[i] = e.target.value; setContent('images', imgs) }}
            placeholder="https://..." />
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Switch checked={c.offset || false} onCheckedChange={v => setContent('offset', v)} />
        <Label className="text-xs tracking-editorial uppercase text-muted-foreground">Stagger middle image lower</Label>
      </div>
    </div>
  )

  if (section.type === 'promo-banner') return (
    <div className="space-y-4 mt-2">
      <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">Banner Text</Label><Textarea rows={3} className="rounded-none mt-1" value={c.text || ''} onChange={e => setContent('text', e.target.value)} placeholder="Promo message…" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">CTA Label</Label><Input className="rounded-none mt-1" value={c.ctaLabel || ''} onChange={e => setContent('ctaLabel', e.target.value)} placeholder="e.g. Shop Now" /></div>
        <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">CTA Action (page name)</Label><Input className="rounded-none mt-1" value={c.ctaAction || ''} onChange={e => setContent('ctaAction', e.target.value)} placeholder="e.g. shop" /></div>
      </div>
      <div><Label className="text-xs tracking-editorial uppercase text-muted-foreground">Background Style</Label>
        <Select value={st.bgColor || 'dark'} onValueChange={v => setStyle('bgColor', v)}>
          <SelectTrigger className="rounded-none mt-1"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="dark">Dark (Primary)</SelectItem><SelectItem value="light">Light (Muted)</SelectItem></SelectContent>
        </Select>
      </div>
    </div>
  )

  return <div className="text-muted-foreground text-sm py-4">No editor available for this section type.</div>
}

// ---------- Footer ----------
function Footer() {
  const { settings, navigate, transparentLogo, collections } = useApp()
  const logoSrc = transparentLogo || settings.logoUrl
  const socialLinks = normalizeSocialLinks(settings?.socialLinks).filter(link => link.visible !== false)
  const boutiqueLinks = getBoutiqueNavItems(settings?.headerNavLinks, collections)
  return (
    <footer className="bg-primary text-primary-foreground py-16 mt-20">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 grid md:grid-cols-3 gap-10">
        <div>
          <div className="text-[11px] tracking-editorial uppercase text-primary-foreground/60 mb-4">Boutique</div>
          <div className="space-y-2 text-sm">
            {boutiqueLinks.map((link) => (
              <button key={link.id} className="block" onClick={() => navigate(link.pageKey || link.page, link.collectionSlug ? { collection: link.collectionSlug } : {})}>{link.footerLabel || link.label}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] tracking-editorial uppercase text-primary-foreground/60 mb-4">Maison</div>
          <div className="space-y-2 text-sm">
            <button className="block" onClick={() => navigate('about')}>The House</button>
            <button className="block" onClick={() => navigate('concierge')}>Concierge</button>
          </div>
        </div>
        <div>
          <div className="text-[11px] tracking-editorial uppercase text-primary-foreground/60 mb-4">Contact</div>
          <div className="space-y-2 text-sm">
            <div>{settings.concierge?.email}</div>
            <div>{settings.concierge?.phone}</div>
          </div>
          <div className="flex flex-wrap gap-3 mt-6">
            {socialLinks.map((link, idx) => {
              const Icon = socialIconFor(link.label)
              return (
                <a key={`${link.label}-${idx}`} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[11px] tracking-editorial uppercase text-primary-foreground/80 hover:text-white transition-colors">
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </a>
              )
            })}
          </div>
        </div>
      </div>
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 mt-14 pt-10 border-t border-primary-foreground/10 flex flex-col items-center gap-6">
        <img src={logoSrc} alt={settings.brand} className={cx('h-20 md:h-24 object-contain brightness-0 invert', !transparentLogo && 'mix-blend-screen')} />
        <div className="text-[11px] tracking-luxe uppercase text-primary-foreground/70">{settings.slogan}</div>
        <div className="text-[11px] tracking-editorial uppercase text-primary-foreground/50 text-center">{settings.footerCopy}</div>
      </div>
    </footer>
  )
}
