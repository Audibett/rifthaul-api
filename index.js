require('dotenv').config()
const express = require('express')
const cors = require('cors')

const authRoutes        = require('./src/routes/auth')
const transporterRoutes = require('./src/routes/transporters')
const bookingRoutes     = require('./src/routes/bookings')

const app  = express()
const PORT = process.env.PORT || 4000

// ── Allowed origins ────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.CLIENT_URL,
].filter(Boolean)

// ── Middleware — must be BEFORE routes ────────────────────────────
app.use(cors({
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
}))

// ❌ REMOVED: app.options('*', cors())  <-- THIS WAS THE CRASH

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Health check ───────────────────────────────────────────────────
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

// ── 404 handler ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` })
})

// ── Global error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message)
  res.status(500).json({ error: err.message || 'Something went wrong. Please try again.' })
})

// ── Start server ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ RiftHaul API running on http://localhost:${PORT}`)
  console.log(`   Allowed origins: ${allowedOrigins.join(', ')}`)
})