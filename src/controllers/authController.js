const supabase = require('../db/supabase')

// ── POST /api/auth/register ────────────────────────────────────────
async function register(req, res) {
  try {
    const {
      name, email, phone, password, role,
      truckType, capacity, location, cargoTypes,
    } = req.body

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return res.status(409).json({
          error: 'An account with this email already exists.',
        })
      }
      throw authError
    }

    const userId = authData.user.id

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: userId, name, phone, role })

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId)
      throw profileError
    }

    // If transporter, create transporter profile
    if (role === 'transporter') {
      const { error: tpError } = await supabase
        .from('transporter_profiles')
        .insert({
          user_id:         userId,
          truck_type:      truckType || '',
          capacity:        capacity  || '',
          location:        location  || '',
          cargo_types:     cargoTypes || [],
          price_per_km:    70,
          price_per_tonne: 500,
          rating:          0,
          trips:           0,
          available:       true,
        })

      if (tpError) {
        await supabase.auth.admin.deleteUser(userId)
        throw tpError
      }
    }

    // Sign in to get session token
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password })

    if (signInError) throw signInError

    return res.status(201).json({
      token: signInData.session.access_token,
      user:  { id: userId, name, email, role },
    })
  } catch (err) {
    console.error('REGISTER ERROR:', err.message)
    return res.status(500).json({ error: err.message || 'Registration failed.' })
  }
}

// ── POST /api/auth/login ───────────────────────────────────────────
async function login(req, res) {
  try {
    const { email, password, role } = req.body

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    const userId = data.user.id

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, role, suspended')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found.' })
    }

    // Block suspended accounts
    if (profile.suspended) {
      return res.status(403).json({
        error: 'Your account has been suspended. Please contact support.',
      })
    }

    // Role mismatch check
    const publicRoles = ['customer', 'transporter']
    if (
      role &&
      publicRoles.includes(role) &&
      publicRoles.includes(profile.role) &&
      profile.role !== role
    ) {
      return res.status(403).json({
        error: `This account is registered as a ${profile.role}. Please select "${profile.role}" to sign in.`,
      })
    }

    return res.status(200).json({
      token: data.session.access_token,
      user: {
        id:    userId,
        name:  profile.name,
        email: data.user.email,
        role:  profile.role,
      },
    })
  } catch (err) {
    console.error('LOGIN ERROR:', err.message)
    return res.status(500).json({ error: 'Login failed. Please try again.' })
  }
}

// ── GET /api/auth/me ───────────────────────────────────────────────
async function getMe(req, res) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, name, phone, role, suspended, created_at')
      .eq('id', req.user.id)
      .single()

    if (error || !profile) {
      return res.status(404).json({ error: 'User not found.' })
    }

    if (profile.suspended) {
      return res.status(403).json({
        error: 'Your account has been suspended. Please contact support.',
      })
    }

    return res.json({
      user: {
        id:    profile.id,
        name:  profile.name,
        email: req.user.email,
        phone: profile.phone,
        role:  profile.role,
      },
    })
  } catch (err) {
    console.error('GETME ERROR:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ── POST /api/auth/forgot-password ────────────────────────────────
async function forgotPassword(req, res) {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' })
    }

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.CLIENT_URL}/reset-password`,
    })

    // Always return success — never reveal if email exists
    return res.status(200).json({
      message: 'If an account with that email exists, a reset link has been sent.',
    })
  } catch (err) {
    console.error('FORGOT PASSWORD ERROR:', err.message)
    return res.status(500).json({ error: 'Failed to send reset email.' })
  }
}

// ── POST /api/auth/reset-password ─────────────────────────────────
async function resetPassword(req, res) {
  try {
    const { password, accessToken } = req.body

    if (!password || !accessToken) {
      return res.status(400).json({ error: 'Password and token are required.' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' })
    }

    const { data: { user }, error: userError } =
      await supabase.auth.getUser(accessToken)

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid or expired reset link.' })
    }

    const { error } = await supabase.auth.admin.updateUserById(
      user.id, { password }
    )

    if (error) throw error

    return res.status(200).json({
      message: 'Password updated successfully. Please log in.',
    })
  } catch (err) {
    console.error('RESET PASSWORD ERROR:', err.message)
    return res.status(500).json({ error: 'Failed to reset password.' })
  }
}

module.exports = { register, login, getMe, forgotPassword, resetPassword }