const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const supabase = require('../db/supabase')

// ── JWT helper ───────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

// ── REGISTER ───────────────────────────────────────────────
async function register(req, res) {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      truckType,
      capacity,
      location,
      cargoTypes
    } = req.body

    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({
        error: 'Name, email, phone, password and role are required.'
      })
    }

    if (!['customer', 'transporter'].includes(role)) {
      return res.status(400).json({
        error: 'Role must be customer or transporter.'
      })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        name,
        email,
        phone,
        password_hash: passwordHash,
        role
      })
      .select('id, name, email, role')
      .single()

    if (userError) throw userError

    if (role === 'transporter') {
      const { error: profileError } = await supabase
        .from('transporter_profiles')
        .insert({
          user_id: user.id,
          truck_type: truckType || '',
          capacity: capacity || '',
          location: location || '',
          cargo_types: cargoTypes || [],
          price_per_km: 70,
          rating: 0,
          trips: 0,
          available: true
        })

      if (profileError) throw profileError
    }

    const token = signToken(user)

    return res.status(201).json({ token, user })

  } catch (err) {
    console.error('REGISTER ERROR:', err)

    return res.status(500).json({
      error: err.message
    })
  }
}

// ── LOGIN ───────────────────────────────────────────────
async function login(req, res) {
  try {
    const { email, password } = req.body

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (error || !user) {
      return res.status(401).json({
        error: 'Invalid credentials'
      })
    }

    const valid = await bcrypt.compare(password, user.password_hash)

    if (!valid) {
      return res.status(401).json({
        error: 'Invalid credentials'
      })
    }

    const token = signToken(user)

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })

  } catch (err) {
    console.error('LOGIN ERROR:', err)

    return res.status(500).json({
      error: err.message
    })
  }
}

// ── ME ───────────────────────────────────────────────
async function getMe(req, res) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, phone, role, created_at')
      .eq('id', req.user.id)
      .single()

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    return res.json({ user })

  } catch (err) {
    console.error('GETME ERROR:', err)

    return res.status(500).json({
      error: err.message
    })
  }
}

module.exports = {
  register,
  login,
  getMe
}