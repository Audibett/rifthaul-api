const supabase = require('../db/supabase')

async function authenticate(req, res, next) {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' })
  }

  const token = header.split(' ')[1]

  try {
    // Verify token with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' })
    }

    // Get profile for role and suspended status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, phone, role, suspended')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return res.status(401).json({ error: 'User profile not found.' })
    }

    if (profile.suspended) {
      return res.status(403).json({
        error: 'Your account has been suspended. Please contact support.',
      })
    }

    req.user = {
      id:    user.id,
      email: user.email,
      name:  profile.name,
      phone: profile.phone,
      role:  profile.role,
    }

    next()
  } catch (err) {
    console.error('Auth middleware error:', err.message)
    return res.status(401).json({ error: 'Authentication failed.' })
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}.`,
      })
    }
    next()
  }
}

module.exports = { authenticate, requireRole }