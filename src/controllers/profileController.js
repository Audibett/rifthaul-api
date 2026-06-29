const supabase = require('../db/supabase')

// ── GET /api/profile ───────────────────────────────────────────────
// Get current user's full profile
async function getProfile(req, res) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, name, phone, role, created_at')
      .eq('id', req.user.id)
      .single()

    if (error || !profile) {
      return res.status(404).json({ error: 'Profile not found.' })
    }

    // If transporter, also get their truck profile
    let transporterProfile = null
    if (profile.role === 'transporter') {
      const { data: tp } = await supabase
        .from('transporter_profiles')
        .select('id, truck_type, capacity, location, cargo_types, price_per_km, price_per_tonne, rating, trips, available')
        .eq('user_id', req.user.id)
        .single()

      transporterProfile = tp || null
    }

    return res.status(200).json({
      profile: {
        id:        profile.id,
        name:      profile.name,
        email:     req.user.email,
        phone:     profile.phone,
        role:      profile.role,
        createdAt: profile.created_at,
        transporter: transporterProfile,
      },
    })
  } catch (err) {
    console.error('GetProfile error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch profile.' })
  }
}

// ── PATCH /api/profile ─────────────────────────────────────────────
// Update basic profile info (name, phone) for all roles
async function updateProfile(req, res) {
  try {
    const { name, phone } = req.body

    const updates = {}
    if (name  !== undefined) updates.name  = name.trim()
    if (phone !== undefined) updates.phone = phone.trim()

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update.' })
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, name, phone, role')
      .single()

    if (error) throw error

    return res.status(200).json({
      message: 'Profile updated successfully.',
      profile: data,
    })
  } catch (err) {
    console.error('UpdateProfile error:', err.message)
    return res.status(500).json({ error: 'Failed to update profile.' })
  }
}

// ── PATCH /api/profile/transporter ────────────────────────────────
// Update transporter-specific details
async function updateTransporterProfile(req, res) {
  try {
    const {
      truckType, capacity, location,
      cargoTypes, pricePerKm, pricePerTonne,
    } = req.body

    const updates = {}
    if (truckType !== undefined)     updates.truck_type      = truckType
    if (capacity !== undefined)      updates.capacity        = capacity
    if (location !== undefined)      updates.location        = location
    if (cargoTypes !== undefined)    updates.cargo_types     = cargoTypes
    if (pricePerKm !== undefined)    updates.price_per_km    = Number(pricePerKm)
    if (pricePerTonne !== undefined) updates.price_per_tonne = Number(pricePerTonne)

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update.' })
    }

    const { data, error } = await supabase
      .from('transporter_profiles')
      .update(updates)
      .eq('user_id', req.user.id)
      .select()
      .single()

    if (error) throw error

    return res.status(200).json({
      message: 'Truck profile updated successfully.',
      profile: data,
    })
  } catch (err) {
    console.error('UpdateTransporterProfile error:', err.message)
    return res.status(500).json({ error: 'Failed to update truck profile.' })
  }
}

// ── PATCH /api/profile/password ────────────────────────────────────
// Change password
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required.',
      })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters.',
      })
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        error: 'New password must be different from your current password.',
      })
    }

    // Verify current password by attempting sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email:    req.user.email,
      password: currentPassword,
    })

    if (signInError) {
      return res.status(401).json({ error: 'Current password is incorrect.' })
    }

    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      req.user.id,
      { password: newPassword }
    )

    if (updateError) throw updateError

    return res.status(200).json({
      message: 'Password changed successfully.',
    })
  } catch (err) {
    console.error('ChangePassword error:', err.message)
    return res.status(500).json({ error: 'Failed to change password.' })
  }
}

module.exports = {
  getProfile,
  updateProfile,
  updateTransporterProfile,
  changePassword,
}