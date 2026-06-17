require('dotenv').config()
const express = require('express')
const cors = require('cors')

const authRoutes = require('./src/routes/auth')
const transporterRoutes = require('./src/routes/transporters')
const bookingRoutes = require('./src/routes/bookings')

const app = express()
const PORT = process.env.PORT || 4000

// ── Middleware ─────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL, // production frontend
].filter(Boolean)

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true)

    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`))
  },
  credentials: true,
}))

// ── Health check ───────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'RiftHaul API is running',
    version: '1.0.0',
  })
})

// ── Routes ─────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/transporters', transporterRoutes)
app.use('/api/bookings', bookingRoutes)

// ── 404 handler ────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` })
})

// ── Global error handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
})

// ── Start server ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ RiftHaul API running on http://localhost:${PORT}`)
})