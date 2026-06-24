require('dotenv').config()
const express = require('express')
const cors = require('cors')

const authRoutes        = require('./src/routes/auth')
const transporterRoutes = require('./src/routes/transporters')
const bookingRoutes     = require('./src/routes/bookings')
const adminRoutes       = require('./src/routes/admin')
const paymentRoutes     = require('./src/routes/payments')
const rateLimit         = require('express-rate-limit')

const app  = express()
const PORT = process.env.PORT || 4000

// ── Allowed origins ───────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'https://rift-haul.vercel.app',
  process.env.CLIENT_URL,
].filter(Boolean)

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true)
    const isAllowed = allowedOrigins.some(
      (o) => origin === o || origin.startsWith(o)
    )
    if (isAllowed) return callback(null, true)
    console.log('CORS blocked for:', origin)
    return callback(new Error(`CORS not allowed for origin: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

// ── Middleware — must be BEFORE routes ────────────────────────────
app.use(cors(corsOptions))          // handles all routes including OPTIONS
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Rate limiting ──────────────────────────────────────────────────

// General limiter — all routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in 15 minutes.' },
})

// Strict limiter — auth routes only
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // only 10 login/register attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
})

// Apply general limiter to all routes
app.use(generalLimiter)

// Apply strict limiter to auth routes specifically
app.use('/api/auth/login',    authLimiter)
app.use('/api/auth/register', authLimiter)


// ── Health check ──────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'RiftHaul API is running',
    version: '1.0.0',
    allowedOrigins,
  })
})

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes)
app.use('/api/transporters', transporterRoutes)
app.use('/api/bookings',     bookingRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/payments', paymentRoutes)

// ── 404 handler ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` })
})

// ── Global error handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message)
  const origin = req.headers.origin
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }
  res.status(500).json({ error: err.message || 'Something went wrong.' })
})

// ── Start server ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ RiftHaul API running on http://localhost:${PORT}`)
  console.log(`   Allowed origins: ${allowedOrigins.join(', ')}`)
})