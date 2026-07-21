import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { DEFAULT_NAV_ITEMS } from '@/lib/navigation'

// ---------- DB ----------
let clientPromise
function getClient() {
  if (!clientPromise) {
    const client = new MongoClient(process.env.MONGO_URL, {
      tls: true,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    })
    clientPromise = client.connect()
  }
  return clientPromise
}
async function db() {
  const c = await getClient()
  return c.db(process.env.DB_NAME)
}

// ---------- Auth helpers ----------
function hashPassword(password, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return { salt, hash: derived }
}
function verifyPassword(password, salt, expectedHash) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(expectedHash, 'hex'))
}
async function getUserFromReq(req) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return null
  const database = await db()
  const session = await database.collection('sessions').findOne({ token })
  if (!session) return null
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) return null
  const user = await database.collection('users').findOne({ id: session.userId })
  if (!user) return null
  const { passwordHash, passwordSalt, ...safe } = user
  return safe
}
function requireAuth(user) {
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return null
}
function requireAdmin(user) {
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// ---------- Seed ----------
let seeded = false
async function seedIfNeeded() {
  if (seeded) return
  const database = await db()
  const admin = await database.collection('users').findOne({ email: 'yashcoofficial@gmail.com' })
  if (!admin) {
    const { salt, hash } = hashPassword('Admin@123')
    await database.collection('users').insertOne({
      id: uuidv4(),
      email: 'yashcoofficial@gmail.com',
      name: 'YASH Atelier',
      role: 'admin',
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date(),
    })
  }
  const settings = await database.collection('settings').findOne({ key: 'site' })
  if (!settings) {
    await database.collection('settings').insertOne({
      key: 'site',
      logoUrl: 'https://customer-assets-jai6qajn.emergentagent.net/job_8bd769ba-1dbc-4d96-9225-ec5b951b5135/artifacts/kmg2jzhg_YASH%20Logo.png',
      brand: 'YASH',
      slogan: 'Own Every Moment',
      heroTitle: 'Own Every Moment',
      heroSubtitle: 'A curated house of quiet luxury — tailored for the ones who define their own era.',
      heroImage: 'https://images.pexels.com/photos/31466152/pexels-photo-31466152.jpeg',
      heroCtaLabel: 'Discover the Collection',
      announcement: 'Complimentary global concierge shipping on orders above ₹50,000',
      aboutTitle: 'The House of YASH',
      aboutBody: 'Rooted in craftsmanship and cut for a global sensibility, YASH is a study in restraint. Each piece is fashioned in small ateliers, from noble fibres, by hands that treat the needle as a signature.',
      lookbookTitle: 'Editorial Lookbook',
      lookbookSubtitle: 'Season 01 — Nocturne',
      lookbookImages: [
        'https://images.pexels.com/photos/35596695/pexels-photo-35596695.jpeg',
        'https://images.pexels.com/photos/28133643/pexels-photo-28133643.jpeg',
        'https://images.pexels.com/photos/28557819/pexels-photo-28557819.jpeg',
      ],
      concierge: {
        title: 'Private Concierge',
        subtitle: 'Bespoke enquiries, private appointments, and made-to-measure requests are received with discretion.',
        email: 'yashcoofficial@gmail.com',
        phone: '+91 00000 00000',
      },
      footerCopy: '© YASH Maison. Made with quiet devotion.',
      currency: 'INR',
      currencySymbol: '₹',
      headerNavLinks: DEFAULT_NAV_ITEMS.map((item) => ({
        label: item.label,
        page: item.pageKey,
        collection: item.collectionSlug || '',
        visible: item.visible,
      })),
      socialLinks: [
        { label: 'Instagram', url: 'https://www.instagram.com/', visible: true },
      ],
      updatedAt: new Date(),
    })
  }
  const requiredCollections = [
    { name: 'Womenswear', slug: 'womenswear', image: 'https://images.pexels.com/photos/35596695/pexels-photo-35596695.jpeg', description: 'Softly tailored silhouettes for the modern woman.', order: 1 },
    { name: 'Menswear', slug: 'menswear', image: 'https://images.pexels.com/photos/28133643/pexels-photo-28133643.jpeg', description: 'Sharply cut suits, quiet knits, considered essentials.', order: 2 },
    { name: 'Accessories', slug: 'accessories', image: 'https://images.pexels.com/photos/28557819/pexels-photo-28557819.jpeg', description: 'Leather, silk, and metal — the finishing gestures.', order: 3 },
  ]

  for (const collection of requiredCollections) {
    const existing = await database.collection('collections').findOne({ slug: collection.slug })
    if (!existing) {
      await database.collection('collections').insertOne({
        id: uuidv4(),
        ...collection,
      })
    }
  }

  const now = new Date()
  const catalog = [
    { name: 'Nocturne Silk Slip Gown', collection: 'womenswear', price: 68000, image: 'https://images.pexels.com/photos/1655841/pexels-photo-1655841.jpeg', description: 'A liquid-silk floor-length gown, cut on the bias. Hand-rolled hems. Fully lined.' },
    { name: 'Onyx Wool Tuxedo', collection: 'menswear', price: 124000, image: 'https://images.pexels.com/photos/32335610/pexels-photo-32335610.jpeg', description: 'A single-button tuxedo in Italian wool with grosgrain silk lapel. Half-canvassed.' },
    { name: 'Ivory Cashmere Long Coat', collection: 'womenswear', price: 96000, image: 'https://images.pexels.com/photos/17542178/pexels-photo-17542178.jpeg', description: 'Pure cashmere long coat with hand-stitched edges. Notched lapel. Concealed placket.' },
    { name: 'Midnight Leather Trench', collection: 'womenswear', price: 138000, image: 'https://images.pexels.com/photos/20591025/pexels-photo-20591025.jpeg', description: 'Full-grain nappa trench, softly draped, with a self-belt and turn-back cuffs.' },
    { name: 'Ivory Poplin Blouse', collection: 'womenswear', price: 22000, image: 'https://images.pexels.com/photos/31450745/pexels-photo-31450745.jpeg', description: 'Crisp Italian cotton poplin. Mother-of-pearl buttons. French seams throughout.' },
    { name: 'Charcoal Cashmere Roll-Neck', collection: 'menswear', price: 34000, image: 'https://images.pexels.com/photos/1453008/pexels-photo-1453008.jpeg', description: 'Fully-fashioned Grade-A cashmere roll-neck in a soft, dry hand.' },
    { name: 'Noir Leather Tote', collection: 'accessories', price: 84000, image: 'https://images.pexels.com/photos/37467312/pexels-photo-37467312.jpeg', description: 'Vegetable-tanned leather tote with saddle-stitched handles. Suede-lined.' },
    { name: 'Silk Twill Foulard', collection: 'accessories', price: 12800, image: 'https://images.pexels.com/photos/19729206/pexels-photo-19729206.jpeg', description: '90cm silk twill scarf with hand-rolled edges. Screen-printed in Como, Italy.' },
    { name: 'Sculpted Gold Timepiece', collection: 'accessories', price: 168000, image: 'https://images.pexels.com/photos/6765639/pexels-photo-6765639.jpeg', description: 'Automatic movement. Sapphire crystal. Solid case in brushed pale gold.' },
    { name: 'Obsidian Derby Shoe', collection: 'menswear', price: 58000, image: 'https://images.pexels.com/photos/135620/pexels-photo-135620.jpeg', description: 'Hand-lasted derby in polished box calf. Goodyear-welted leather soles.' },
  ]

  for (const product of catalog) {
    const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const existingProduct = await database.collection('products').findOne({ slug })
    if (!existingProduct) {
      await database.collection('products').insertOne({
        id: uuidv4(),
        name: product.name,
        slug,
        description: product.description,
        collection: product.collection,
        price: product.price,
        salePrice: null,
        onSale: false,
        sku: `YSH-${uuidv4().slice(0, 6).toUpperCase()}`,
        stock: 12,
        images: [product.image],
        sizes: ['XS','S','M','L','XL'],
        colors: ['Noir','Ivory','Champagne'],
        material: 'Sourced from premier European mills.',
        care: 'Professional dry-clean only. Store on a padded hanger.',
        sizeGuide: 'Please refer to your usual fit. If you are between sizes, we recommend sizing up for a relaxed drape. For bespoke fit guidance, contact our concierge.',
        featured: catalog.indexOf(product) < 4,
        createdAt: now,
        lowStockThreshold: 3,
      })
    }
  }
  seeded = true
}

// ---------- Utility ----------
function json(data, status = 200) { return NextResponse.json(data, { status }) }
function stripId(doc) {
  if (!doc) return doc
  const { _id, passwordHash, passwordSalt, ...rest } = doc
  return rest
}
async function parseBody(req) { try { return await req.json() } catch { return {} } }

// ---------- Router ----------
async function route(req, method, segments) {
  await seedIfNeeded()
  const database = await db()
  const [root, ...rest] = segments

  if (root === 'auth') {
    const action = rest[0]
    if (action === 'register' && method === 'POST') {
      const body = await parseBody(req)
      const { email, password, name } = body
      if (!email || !password) return json({ error: 'Email and password required' }, 400)
      const exists = await database.collection('users').findOne({ email: email.toLowerCase() })
      if (exists) return json({ error: 'Email already registered' }, 400)
      const { salt, hash } = hashPassword(password)
      const user = { id: uuidv4(), email: email.toLowerCase(), name: name || email.split('@')[0], role: 'customer', passwordSalt: salt, passwordHash: hash, createdAt: new Date() }
      await database.collection('users').insertOne(user)
      const token = crypto.randomBytes(32).toString('hex')
      await database.collection('sessions').insertOne({ token, userId: user.id, createdAt: new Date(), expiresAt: new Date(Date.now() + 1000*60*60*24*30) })
      return json({ token, user: stripId(user) })
    }
    if (action === 'login' && method === 'POST') {
      const { email, password } = await parseBody(req)
      const user = await database.collection('users').findOne({ email: (email||'').toLowerCase() })
      if (!user) return json({ error: 'Invalid credentials' }, 401)
      if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) return json({ error: 'Invalid credentials' }, 401)
      const token = crypto.randomBytes(32).toString('hex')
      await database.collection('sessions').insertOne({ token, userId: user.id, createdAt: new Date(), expiresAt: new Date(Date.now() + 1000*60*60*24*30) })
      return json({ token, user: stripId(user) })
    }
    if (action === 'forgot' && method === 'POST') {
      const { email } = await parseBody(req)
      const user = await database.collection('users').findOne({ email: (email||'').toLowerCase() })
      if (!user) return json({ ok: true, message: 'If the account exists, a reset link has been sent.' })
      const resetToken = crypto.randomBytes(24).toString('hex')
      await database.collection('resetTokens').insertOne({ token: resetToken, userId: user.id, createdAt: new Date(), expiresAt: new Date(Date.now() + 1000*60*60) })
      return json({ ok: true, mockedResetToken: resetToken, message: 'Email service is mocked — use the token below.' })
    }
    if (action === 'reset' && method === 'POST') {
      const { token: rt, newPassword } = await parseBody(req)
      const record = await database.collection('resetTokens').findOne({ token: rt })
      if (!record) return json({ error: 'Invalid or expired token' }, 400)
      if (new Date(record.expiresAt) < new Date()) return json({ error: 'Token expired' }, 400)
      const { salt, hash } = hashPassword(newPassword)
      await database.collection('users').updateOne({ id: record.userId }, { $set: { passwordSalt: salt, passwordHash: hash } })
      await database.collection('resetTokens').deleteOne({ token: rt })
      return json({ ok: true })
    }
    if (action === 'me' && method === 'GET') {
      const user = await getUserFromReq(req)
      return json({ user })
    }
    if (action === 'logout' && method === 'POST') {
      const auth = req.headers.get('authorization') || ''
      const token = auth.replace('Bearer ', '').trim()
      if (token) await database.collection('sessions').deleteOne({ token })
      return json({ ok: true })
    }
  }

  if (root === 'products') {
    if (method === 'GET' && rest.length === 0) {
      const q = new URL(req.url).searchParams
      const filter = {}
      if (q.get('collection')) filter.collection = q.get('collection')
      if (q.get('color')) filter.colors = q.get('color')
      if (q.get('size')) filter.sizes = q.get('size')
      if (q.get('minPrice')) filter.price = { ...(filter.price||{}), $gte: parseInt(q.get('minPrice')) }
      if (q.get('maxPrice')) filter.price = { ...(filter.price||{}), $lte: parseInt(q.get('maxPrice')) }
      if (q.get('featured') === 'true') filter.featured = true
      if (q.get('search')) filter.name = { $regex: q.get('search'), $options: 'i' }
      const sort = q.get('sort')
      let cursor = database.collection('products').find(filter)
      if (sort === 'price_asc') cursor = cursor.sort({ price: 1 })
      else if (sort === 'price_desc') cursor = cursor.sort({ price: -1 })
      else cursor = cursor.sort({ createdAt: -1 })
      const items = (await cursor.toArray()).map(stripId)
      return json({ products: items })
    }
    if (method === 'GET' && rest.length === 1) {
      const p = await database.collection('products').findOne({ id: rest[0] })
      if (!p) return json({ error: 'Not found' }, 404)
      return json({ product: stripId(p) })
    }
    const user = await getUserFromReq(req)
    const admErr = requireAdmin(user); if (admErr) return admErr
    if (method === 'POST' && rest.length === 0) {
      const body = await parseBody(req)
      const doc = {
        id: uuidv4(),
        name: body.name || 'Untitled',
        slug: (body.name||'untitled').toLowerCase().replace(/[^a-z0-9]+/g,'-'),
        description: body.description || '',
        collection: body.collection || 'womenswear',
        price: parseInt(body.price)||0,
        salePrice: body.salePrice ? parseInt(body.salePrice) : null,
        onSale: !!body.onSale,
        sku: body.sku || `YSH-${Date.now()}`,
        stock: parseInt(body.stock) || 0,
        images: body.images || [],
        sizes: body.sizes || ['XS','S','M','L','XL'],
        colors: body.colors || ['Noir'],
        material: body.material || '',
        care: body.care || '',
        sizeGuide: body.sizeGuide || '',
        featured: !!body.featured,
        lowStockThreshold: parseInt(body.lowStockThreshold) || 3,
        createdAt: new Date(),
      }
      await database.collection('products').insertOne(doc)
      return json({ product: stripId(doc) })
    }
    if (method === 'PUT' && rest.length === 1) {
      const body = await parseBody(req)
      delete body._id; delete body.id
      if (body.price !== undefined) body.price = parseInt(body.price)
      if (body.salePrice) body.salePrice = parseInt(body.salePrice)
      if (body.stock !== undefined) body.stock = parseInt(body.stock)
      await database.collection('products').updateOne({ id: rest[0] }, { $set: body })
      const p = await database.collection('products').findOne({ id: rest[0] })
      return json({ product: stripId(p) })
    }
    if (method === 'DELETE' && rest.length === 1) {
      await database.collection('products').deleteOne({ id: rest[0] })
      return json({ ok: true })
    }
  }

  if (root === 'collections') {
    if (method === 'GET') {
      const items = (await database.collection('collections').find({}).sort({ order: 1 }).toArray()).map(stripId)
      return json({ collections: items })
    }
    const user = await getUserFromReq(req)
    const admErr = requireAdmin(user); if (admErr) return admErr
    if (method === 'POST') {
      const body = await parseBody(req)
      const doc = { id: uuidv4(), name: body.name, slug: (body.slug||body.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-'), image: body.image||'', description: body.description||'', order: parseInt(body.order)||0 }
      await database.collection('collections').insertOne(doc)
      return json({ collection: stripId(doc) })
    }
    if (method === 'PUT' && rest.length === 1) {
      const body = await parseBody(req)
      delete body._id; delete body.id
      await database.collection('collections').updateOne({ id: rest[0] }, { $set: body })
      const c = await database.collection('collections').findOne({ id: rest[0] })
      return json({ collection: stripId(c) })
    }
    if (method === 'DELETE' && rest.length === 1) {
      await database.collection('collections').deleteOne({ id: rest[0] })
      return json({ ok: true })
    }
  }

  if (root === 'settings') {
    if (method === 'GET') {
      const s = await database.collection('settings').findOne({ key: 'site' })
      return json({ settings: stripId(s) })
    }
    const user = await getUserFromReq(req)
    const admErr = requireAdmin(user); if (admErr) return admErr
    if (method === 'PUT') {
      const body = await parseBody(req)
      delete body._id; delete body.key
      body.updatedAt = new Date()
      await database.collection('settings').updateOne({ key: 'site' }, { $set: body }, { upsert: true })
      const s = await database.collection('settings').findOne({ key: 'site' })
      return json({ settings: stripId(s) })
    }
  }

  if (root === 'orders') {
    const user = await getUserFromReq(req)
    if (method === 'POST' && rest.length === 0) {
      const body = await parseBody(req)
      const doc = {
        id: uuidv4(),
        orderNumber: 'YSH' + Date.now().toString().slice(-8),
        userId: user?.id || null,
        customerName: body.customerName || user?.name || '',
        customerEmail: body.customerEmail || user?.email || '',
        customerPhone: body.customerPhone || '',
        items: body.items || [],
        subtotal: body.subtotal || 0,
        shipping: body.shipping || 0,
        total: body.total || 0,
        shippingAddress: body.shippingAddress || {},
        notes: body.notes || '',
        status: 'Enquiry Received',
        paymentStatus: 'Awaiting Confirmation',
        trackingNumber: '',
        createdAt: new Date(),
        history: [{ status: 'Enquiry Received', at: new Date(), note: 'We have received your enquiry.' }],
      }
      await database.collection('orders').insertOne(doc)
      return json({ order: stripId(doc) })
    }
    if (method === 'GET' && rest.length === 0) {
      const authErr = requireAuth(user); if (authErr) return authErr
      const filter = user.role === 'admin' ? {} : { userId: user.id }
      const items = (await database.collection('orders').find(filter).sort({ createdAt: -1 }).toArray()).map(stripId)
      return json({ orders: items })
    }
    if (method === 'GET' && rest.length === 1) {
      const authErr = requireAuth(user); if (authErr) return authErr
      const o = await database.collection('orders').findOne({ id: rest[0] })
      if (!o) return json({ error: 'Not found' }, 404)
      if (user.role !== 'admin' && o.userId !== user.id) return json({ error: 'Forbidden' }, 403)
      return json({ order: stripId(o) })
    }
    if (method === 'PUT' && rest.length === 1) {
      const admErr = requireAdmin(user); if (admErr) return admErr
      const body = await parseBody(req)
      const set = {}
      if (body.status) set.status = body.status
      if (body.paymentStatus) set.paymentStatus = body.paymentStatus
      if (body.trackingNumber !== undefined) set.trackingNumber = body.trackingNumber
      if (body.adminNotes !== undefined) set.adminNotes = body.adminNotes
      const update = { $set: set }
      if (body.status) update.$push = { history: { status: body.status, at: new Date(), note: body.historyNote || '' } }
      await database.collection('orders').updateOne({ id: rest[0] }, update)
      const o = await database.collection('orders').findOne({ id: rest[0] })
      return json({ order: stripId(o) })
    }
  }

  if (root === 'inquiries') {
    if (method === 'POST' && rest.length === 0) {
      const body = await parseBody(req)
      const doc = { id: uuidv4(), name: body.name||'', email: body.email||'', phone: body.phone||'', subject: body.subject||'General Enquiry', message: body.message||'', productId: body.productId||null, status: 'New', response: '', createdAt: new Date() }
      await database.collection('inquiries').insertOne(doc)
      return json({ inquiry: stripId(doc) })
    }
    const user = await getUserFromReq(req)
    const admErr = requireAdmin(user); if (admErr) return admErr
    if (method === 'GET') {
      const items = (await database.collection('inquiries').find({}).sort({ createdAt: -1 }).toArray()).map(stripId)
      return json({ inquiries: items })
    }
    if (method === 'PUT' && rest.length === 1) {
      const body = await parseBody(req)
      delete body._id; delete body.id
      await database.collection('inquiries').updateOne({ id: rest[0] }, { $set: body })
      const i = await database.collection('inquiries').findOne({ id: rest[0] })
      return json({ inquiry: stripId(i) })
    }
    if (method === 'DELETE' && rest.length === 1) {
      await database.collection('inquiries').deleteOne({ id: rest[0] })
      return json({ ok: true })
    }
  }

  if (root === 'wishlist') {
    const user = await getUserFromReq(req)
    const authErr = requireAuth(user); if (authErr) return authErr
    if (method === 'GET') {
      const wl = await database.collection('wishlists').findOne({ userId: user.id })
      const productIds = wl?.productIds || []
      const products = productIds.length ? (await database.collection('products').find({ id: { $in: productIds } }).toArray()).map(stripId) : []
      return json({ productIds, products })
    }
    if (method === 'POST') {
      const { productId } = await parseBody(req)
      await database.collection('wishlists').updateOne({ userId: user.id }, { $addToSet: { productIds: productId } }, { upsert: true })
      return json({ ok: true })
    }
    if (method === 'DELETE' && rest.length === 1) {
      await database.collection('wishlists').updateOne({ userId: user.id }, { $pull: { productIds: rest[0] } })
      return json({ ok: true })
    }
  }

  if (root === 'addresses') {
    const user = await getUserFromReq(req)
    const authErr = requireAuth(user); if (authErr) return authErr
    if (method === 'GET') {
      const items = (await database.collection('addresses').find({ userId: user.id }).toArray()).map(stripId)
      return json({ addresses: items })
    }
    if (method === 'POST') {
      const body = await parseBody(req)
      const doc = { id: uuidv4(), userId: user.id, ...body, createdAt: new Date() }
      delete doc._id
      await database.collection('addresses').insertOne(doc)
      return json({ address: stripId(doc) })
    }
    if (method === 'PUT' && rest.length === 1) {
      const body = await parseBody(req)
      delete body._id; delete body.id
      await database.collection('addresses').updateOne({ id: rest[0], userId: user.id }, { $set: body })
      const a = await database.collection('addresses').findOne({ id: rest[0] })
      return json({ address: stripId(a) })
    }
    if (method === 'DELETE' && rest.length === 1) {
      await database.collection('addresses').deleteOne({ id: rest[0], userId: user.id })
      return json({ ok: true })
    }
  }

  if (root === 'admin' && rest[0] === 'overview' && method === 'GET') {
    const user = await getUserFromReq(req)
    const admErr = requireAdmin(user); if (admErr) return admErr
    const [productCount, orderCount, inquiryCount, userCount, lowStock] = await Promise.all([
      database.collection('products').countDocuments(),
      database.collection('orders').countDocuments(),
      database.collection('inquiries').countDocuments({ status: 'New' }),
      database.collection('users').countDocuments(),
      database.collection('products').find({ $expr: { $lte: ['$stock', '$lowStockThreshold'] } }).toArray(),
    ])
    return json({ productCount, orderCount, inquiryCount, userCount, lowStock: lowStock.map(stripId) })
  }

  if (root === undefined || root === '' || root === 'health') return json({ ok: true, service: 'YASH API' })

  return json({ error: 'Not found', path: segments.join('/') }, 404)
}

async function handle(req, ctx, method) {
  try {
    const params = await ctx.params
    const segments = params?.path || []
    return await route(req, method, segments)
  } catch (e) {
    console.error('API error', e)
    return NextResponse.json({ error: 'Server error', detail: String(e?.message || e) }, { status: 500 })
  }
}

export async function GET(req, ctx) { return handle(req, ctx, 'GET') }
export async function POST(req, ctx) { return handle(req, ctx, 'POST') }
export async function PUT(req, ctx) { return handle(req, ctx, 'PUT') }
export async function DELETE(req, ctx) { return handle(req, ctx, 'DELETE') }
export async function PATCH(req, ctx) { return handle(req, ctx, 'PATCH') }
