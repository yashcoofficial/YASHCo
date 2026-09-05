import { NextResponse } from '../../../lib/http-response.js'
import { MongoClient } from 'mongodb'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { v4 as uuidv4 } from 'uuid'
import { DEFAULT_NAV_ITEMS } from '../../../lib/navigation.js'

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
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret-change-me'
const LOGIN_WINDOW_MS = 1000 * 60 * 15
const MAX_LOGIN_ATTEMPTS = 5
const loginAttemptTracker = new Map()

function base64Url(value) {
  return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
function createJwt(payload, expiresInSeconds = 60 * 60 * 24 * 30) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + expiresInSeconds }
  const encodedHeader = base64Url(JSON.stringify(header))
  const encodedPayload = base64Url(JSON.stringify(body))
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${encodedHeader}.${encodedPayload}`).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return `${encodedHeader}.${encodedPayload}.${signature}`
}
function verifyJwt(token) {
  try {
    const [header, payload, signature] = token.split('.')
    if (!header || !payload || !signature) return null
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    if (expected !== signature) return null
    const decoded = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null
    return decoded
  } catch {
    return null
  }
}
function hashPassword(password, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return { salt, hash: derived }
}
function verifyPassword(password, salt, expectedHash) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(expectedHash, 'hex'))
}
function createTokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}
function getClientIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local'
}
function checkLoginRateLimit(req, email) {
  const key = `login:${getClientIp(req)}:${(email || '').toLowerCase()}`
  const now = Date.now()
  const current = loginAttemptTracker.get(key)
  if (!current || current.expiresAt <= now) {
    loginAttemptTracker.set(key, { count: 1, expiresAt: now + LOGIN_WINDOW_MS })
    return true
  }
  if (current.count >= MAX_LOGIN_ATTEMPTS) return false
  current.count += 1
  loginAttemptTracker.set(key, current)
  return true
}
function resetLoginRateLimit(req, email) {
  const key = `login:${getClientIp(req)}:${(email || '').toLowerCase()}`
  loginAttemptTracker.delete(key)
}
function parseUserAgent(req) {
  const ua = req.headers.get('user-agent') || ''
  const browser = ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : ua.includes('Edge') ? 'Edge' : 'Unknown'
  const device = ua.includes('iPhone') ? 'iPhone' : ua.includes('Android') ? 'Android' : ua.includes('Mac') ? 'Mac' : ua.includes('Windows') ? 'Windows' : 'Desktop'
  return { browser, device }
}
async function sendEmail({ to, from, subject, text, html }) {
  const recipients = Array.isArray(to) ? to : [to]
  const mailFrom = from || process.env.EMAIL_FROM || 'concierge@yashatelier.store'

  if (process.env.RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mailFrom,
        to: recipients,
        subject,
        text,
        html,
      }),
    })
    if (!response.ok) throw new Error('Email provider rejected the request')
    return { ok: true, provider: 'resend' }
  }

  if (process.env.SMTP_HOST) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
    await transporter.sendMail({
      from: mailFrom,
      to: recipients.join(', '),
      subject,
      text,
      html,
    })
    return { ok: true, provider: 'smtp' }
  }

  console.info(`[mail] to=${recipients.join(', ')} from=${mailFrom} subject=${subject}`)
  return { ok: true, provider: 'console' }
}
async function sendLoginSuccessEmail(user, req) {
  const { browser, device } = parseUserAgent(req)
  const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
  const ip = forwardedFor.split(',')[0].trim() || 'Unavailable'
  const location = req.headers.get('x-vercel-ip-country') || req.headers.get('x-vercel-ip-city') || 'Unavailable'
  const body = [
    'Your account was accessed successfully.',
    '',
    `Time: ${new Date().toISOString()}`,
    `Device: ${device}`,
    `Browser: ${browser}`,
    `IP: ${ip}`,
    `Location: ${location}`,
  ].join('\n')
  await sendEmail({
    to: user.email,
    from: 'concierge@yashatelier.store',
    subject: 'Login Successful – YASH',
    text: body,
    html: `<p>${body.replace(/\n/g, '<br />')}</p>`,
  })
}
async function createSession(database, userId, token, expiresAt) {
  await database.collection('sessions').insertOne({ tokenHash: createTokenHash(token), userId, createdAt: new Date(), expiresAt })
}
async function getUserFromReq(req) {
  const auth = req.headers.get('authorization') || ''
  const cookieToken = req.cookies.get('yash_auth')?.value || ''
  const token = auth.replace('Bearer ', '').trim() || cookieToken
  if (!token) return null
  const verified = verifyJwt(token)
  if (!verified) return null
  const database = await db()
  const session = await database.collection('sessions').findOne({ tokenHash: createTokenHash(token) })
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
    { name: 'Womenswear', slug: 'womenswear', image: 'https://images.pexels.com/photos/35596695/pexels-photo-35596695.jpeg', description: 'Softly tailored silhouettes for the modern woman.', order: 1, parentSlug: null },
    { name: 'Menswear', slug: 'menswear', image: 'https://images.pexels.com/photos/28133643/pexels-photo-28133643.jpeg', description: 'Sharply cut suits, quiet knits, considered essentials.', order: 2, parentSlug: null },
    { name: 'Accessories', slug: 'accessories', image: 'https://images.pexels.com/photos/28557819/pexels-photo-28557819.jpeg', description: 'Leather, silk, and metal — the finishing gestures.', order: 3, parentSlug: null },
    { name: 'Shirts', slug: 'menswear-shirts', image: '', description: 'Polished shirts for every considered occasion.', order: 1, parentSlug: 'menswear' },
    { name: 'Trousers', slug: 'menswear-trousers', image: '', description: 'Tailored trousers with an easy, precise line.', order: 2, parentSlug: 'menswear' },
    { name: 'T-Shirts', slug: 'menswear-t-shirts', image: '', description: 'Refined everyday jersey essentials.', order: 3, parentSlug: 'menswear' },
    { name: 'Men', slug: 'accessories-men', image: '', description: 'Finishing pieces for the modern man.', order: 1, parentSlug: 'accessories' },
    { name: 'Women', slug: 'accessories-women', image: '', description: 'Finishing pieces for the modern woman.', order: 2, parentSlug: 'accessories' },
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
function json(data, status = 200, cookies = {}) {
  const response = NextResponse.json(data, { status })
  Object.entries(cookies).forEach(([name, value]) => {
    if (value) response.cookies.set(name, value, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 })
  })
  return response
}
function excelCell(value) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? '')
  return `<Cell><Data ss:Type="String">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</Data></Cell>`
}
function excelWorkbook(sheetName, columns, rows) {
  const header = columns.map(column => excelCell(column.label)).join('')
  const body = rows.map(row => `<Row>${columns.map(column => excelCell(row[column.key])).join('')}</Row>`).join('')
  const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${sheetName}"><Table><Row>${header}</Row>${body}</Table></Worksheet></Workbook>`
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="yash-${sheetName.toLowerCase()}.xls"`,
    },
  })
}
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
      const { email, password, name, phone } = body
      if (!email || !password) return json({ error: 'Email and password required' }, 400)
      const exists = await database.collection('users').findOne({ email: email.toLowerCase() })
      if (exists) return json({ error: 'Email already registered' }, 400)
      const { salt, hash } = hashPassword(password)
      const user = { id: uuidv4(), email: email.toLowerCase(), name: name || email.split('@')[0], phone: phone || '', role: 'customer', passwordSalt: salt, passwordHash: hash, createdAt: new Date() }
      await database.collection('users').insertOne(user)
      const token = createJwt({ sub: user.id, role: user.role, email: user.email })
      const expiresAt = new Date(Date.now() + 1000*60*60*24*30)
      await createSession(database, user.id, token, expiresAt)
      return json({ token, user: stripId(user) }, 200, { yash_auth: token })
    }
    if (action === 'login' && method === 'POST') {
      const { email, password } = await parseBody(req)
      if (!checkLoginRateLimit(req, email)) return json({ error: 'Too many login attempts. Please try again shortly.' }, 429)
      const user = await database.collection('users').findOne({ email: (email||'').toLowerCase() })
      if (!user) return json({ error: 'Invalid credentials' }, 401)
      if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) return json({ error: 'Invalid credentials' }, 401)
      const token = createJwt({ sub: user.id, role: user.role, email: user.email })
      const expiresAt = new Date(Date.now() + 1000*60*60*24*30)
      await createSession(database, user.id, token, expiresAt)
      await sendLoginSuccessEmail(stripId(user), req)
      resetLoginRateLimit(req, email)
      return json({ token, user: stripId(user) }, 200, { yash_auth: token })
    }
    if (action === 'forgot' && method === 'POST') {
      const { email } = await parseBody(req)
      const user = await database.collection('users').findOne({ email: (email||'').toLowerCase() })
      if (!user) return json({ ok: true, message: 'If the account exists, a reset link has been sent.' })
      const resetToken = crypto.randomBytes(24).toString('hex')
      const resetTokenHash = createTokenHash(resetToken)
      const origin = process.env.APP_URL || `https://${req.headers.get('host') || 'localhost:3000'}`
      const resetUrl = `${origin}/reset?token=${encodeURIComponent(resetToken)}`
      await database.collection('resetTokens').insertOne({ tokenHash: resetTokenHash, userId: user.id, createdAt: new Date(), expiresAt: new Date(Date.now() + 1000*60*30) })
      await sendEmail({
        to: user.email,
        from: process.env.EMAIL_FROM || 'concierge@yashatelier.store',
        subject: 'Password reset request – YASH',
        text: `Hello ${user.name || 'there'},\n\nWe received a request to reset your YASH account password.\nUse the secure link below to continue:\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
        html: `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f1f1f;"><h2 style="margin-bottom: 8px;">Reset your YASH password</h2><p>Hello ${user.name || 'there'},</p><p>We received a request to reset your YASH account password.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#c8a15b;color:#fff;text-decoration:none;border-radius:4px;">Reset Password</a></p><p>If you did not request this, you can safely ignore this email.</p></div>`,
      })
      return json({ ok: true, message: 'A secure password reset email has been sent to your inbox. Please follow the link in the email to continue.' })
    }
    if (action === 'reset' && method === 'POST') {
      const { token: rt, newPassword } = await parseBody(req)
      const resetTokenHash = createTokenHash(rt)
      const record = await database.collection('resetTokens').findOne({ tokenHash: resetTokenHash })
      if (!record) return json({ error: 'Invalid or expired token' }, 400)
      if (new Date(record.expiresAt) < new Date()) return json({ error: 'Token expired' }, 400)
      const { salt, hash } = hashPassword(newPassword)
      await database.collection('users').updateOne({ id: record.userId }, { $set: { passwordSalt: salt, passwordHash: hash } })
      await database.collection('resetTokens').deleteOne({ tokenHash: resetTokenHash })
      return json({ ok: true })
    }
    if (action === 'me' && method === 'GET') {
      const user = await getUserFromReq(req)
      return json({ user })
    }
    if (action === 'logout' && method === 'POST') {
      const auth = req.headers.get('authorization') || ''
      const cookieToken = req.cookies.get('yash_auth')?.value || ''
      const token = auth.replace('Bearer ', '').trim() || cookieToken
      if (token) await database.collection('sessions').deleteOne({ tokenHash: createTokenHash(token) })
      return json({ ok: true })
    }
  }

  if (root === 'products') {
    if (method === 'GET' && rest.length === 0) {
      const q = new URL(req.url).searchParams
      const filter = {}
      if (q.get('collection')) {
        const selectedCollection = await database.collection('collections').findOne({ slug: q.get('collection') })
        const childSlugs = selectedCollection
          ? (await database.collection('collections').find({ parentSlug: selectedCollection.slug }).toArray()).map(collection => collection.slug)
          : []
        filter.collection = { $in: [q.get('collection'), ...childSlugs] }
      }
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
        shipping: Math.max(0, parseInt(body.shipping) || 0),
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
      if (body.shipping !== undefined) body.shipping = Math.max(0, parseInt(body.shipping) || 0)
      await database.collection('products').updateOne({ id: rest[0] }, { $set: body })
      const p = await database.collection('products').findOne({ id: rest[0] })
      return json({ product: stripId(p) })
    }
    if (method === 'DELETE' && rest.length === 1) {
      await database.collection('products').deleteOne({ id: rest[0] })
      return json({ ok: true })
    }
  }

  if (root === 'users') {
    const user = await getUserFromReq(req)
    const admErr = requireAdmin(user); if (admErr) return admErr
    if (method === 'GET' && rest.length === 0) {
      const items = (await database.collection('users').find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 }).toArray()).map(stripId)
      return json({ users: items })
    }
  }

  if (root === 'admin' && rest[0] === 'export' && method === 'GET') {
    const user = await getUserFromReq(req)
    const admErr = requireAdmin(user); if (admErr) return admErr
    if (rest[1] === 'clients') {
      const clients = (await database.collection('users').find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 }).toArray()).map(stripId)
      return excelWorkbook('clients', [
        { key: 'id', label: 'Client ID' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'role', label: 'Role' },
        { key: 'createdAt', label: 'Joined' },
      ], clients)
    }
    if (rest[1] === 'orders') {
      const orders = (await database.collection('orders').find({}).sort({ createdAt: -1 }).toArray()).map(order => ({
        ...order,
        items: JSON.stringify(order.items || []),
        shippingAddress: JSON.stringify(order.shippingAddress || {}),
      }))
      return excelWorkbook('orders', [
        { key: 'id', label: 'Order ID' },
        { key: 'orderNumber', label: 'Order Number' },
        { key: 'userId', label: 'Client ID' },
        { key: 'customerName', label: 'Customer Name' },
        { key: 'customerEmail', label: 'Customer Email' },
        { key: 'customerPhone', label: 'Customer Phone' },
        { key: 'items', label: 'Items' },
        { key: 'subtotal', label: 'Subtotal' },
        { key: 'shipping', label: 'Shipping' },
        { key: 'total', label: 'Total' },
        { key: 'shippingAddress', label: 'Shipping Address' },
        { key: 'status', label: 'Status' },
        { key: 'paymentStatus', label: 'Payment Status' },
        { key: 'trackingNumber', label: 'Tracking Number' },
        { key: 'createdAt', label: 'Created' },
      ], orders)
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
      const doc = { id: uuidv4(), name: body.name, slug: (body.slug||body.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-'), parentSlug: body.parentSlug || null, image: body.image||'', description: body.description||'', order: parseInt(body.order)||0 }
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
      const collection = await database.collection('collections').findOne({ id: rest[0] })
      if (collection?.parentSlug) await database.collection('products').updateMany({ collection: collection.slug }, { $set: { collection: collection.parentSlug } })
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
      const authErr = requireAuth(user); if (authErr) return authErr
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
    if (method === 'DELETE' && rest.length === 1) {
      const admErr = requireAdmin(user); if (admErr) return admErr
      await database.collection('orders').deleteOne({ id: rest[0] })
      return json({ ok: true })
    }
  }

  if (root === 'inquiries') {
    if (method === 'POST' && rest.length === 0) {
      const user = await getUserFromReq(req)
      const body = await parseBody(req)
      // Basic validation
      if (!body.name || !body.email || !body.phone || !body.message) return json({ error: 'name, email, phone and message are required' }, 400)
      const doc = { id: uuidv4(), userId: user?.id || null, name: body.name||'', email: body.email||'', phone: body.phone||'', subject: body.subject||'General Enquiry', message: body.message||'', productId: body.productId||null, status: 'New', response: '', createdAt: new Date() }
      await database.collection('inquiries').insertOne(doc)
      return json({ inquiry: stripId(doc) })
    }
    const user = await getUserFromReq(req)
    // Allow admin to list all enquiries; allow authenticated users to list their own
    if (method === 'GET') {
      if (!user) return json({ error: 'Unauthorized' }, 401)
      if (user.role === 'admin') {
        const items = (await database.collection('inquiries').find({}).sort({ createdAt: -1 }).toArray()).map(stripId)
        return json({ inquiries: items })
      }
      const items = (await database.collection('inquiries').find({ userId: user.id }).sort({ createdAt: -1 }).toArray()).map(stripId)
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
