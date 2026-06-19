const supabase = require('../db/supabase')

// ── GET /api/transporters ──────────────────────────────────────────
// Public: list all transporters with optional filters
async function getTransporters(req, res) {
  try {
    const { search, cargoType, capacity, availableOnly } = req.query

    const { data, error } = await supabase
      .from('transporter_profiles')
      .select(`
        id,
        user_id,
        truck_type,
        capacity,
        location,
        cargo_types,
        price_per_km,
        price_per_tonne,
        rating,
        trips,
        available,
        users ( id, name, phone )
      `)

    if (error) throw error

    // Shape into clean frontend-friendly format
    let transporters = data.map((t) => ({
      id: t.id,
      userId: t.user_id,
      name: t.users?.name || 'Unknown',
      phone: t.users?.phone || '',
      truck: t.truck_type,
      capacity: t.capacity,
      location: t.location,
      cargoTypes: t.cargo_types || [],
      pricePerKm: t.price_per_km,
      pricePerTonne: t.price_per_tonne,
      rating: t.rating,
      trips: t.trips,
      available: t.available,
    }))

    // Filter: available only
    if (availableOnly === 'true') {
      transporters = transporters.filter((t) => t.available)
    }

    // Filter: search by name, truck, location
    if (search) {
      const s = search.toLowerCase()
      transporters = transporters.filter(
        (t) =>
          t.name.toLowerCase().includes(s) ||
          t.truck.toLowerCase().includes(s) ||
          t.location.toLowerCase().includes(s)
      )
    }

    // Filter: cargo type
    if (cargoType && cargoType !== 'All') {
      transporters = transporters.filter((t) =>
        t.cargoTypes.includes(cargoType)
      )
    }

    // Filter: capacity
    if (capacity && capacity !== 'All') {
      transporters = transporters.filter((t) => {
        const cap = parseInt(t.capacity)
        if (capacity === '1-2 tonnes') return cap <= 2
        if (capacity === '3-5 tonnes') return cap >= 3 && cap <= 5
        if (capacity === '10+ tonnes') return cap >= 10
        return true
      })
    }

    return res.status(200).json({ transporters })
  } catch (err) {
    console.error('GetTransporters error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch transporters.' })
  }
}

// ── GET /api/transporters/:id ──────────────────────────────────────
async function getTransporterById(req, res) {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('transporter_profiles')
      .select(`
        id,
        user_id,
        truck_type,
        capacity,
        location,
        cargo_types,
        price_per_km,
        price_per_tonne,
        rating,
        trips,
        available,
        users ( id, name, phone, email )
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Transporter not found.' })
    }

    const transporter = {
      id: data.id,
      userId: data.user_id,
      name: data.users?.name,
      phone: data.users?.phone,
      email: data.users?.email,
      truck: data.truck_type,
      capacity: data.capacity,
      location: data.location,
      cargoTypes: data.cargo_types || [],
      pricePerKm: data.price_per_km,
      pricePerTonne: data.price_per_tonne,
      rating: data.rating,
      trips: data.trips,
      available: data.available,
    }

    return res.status(200).json({ transporter })
  } catch (err) {
    console.error('GetTransporterById error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch transporter.' })
  }
}

// ── PATCH /api/transporters/availability ──────────────────────────
// Transporter toggles their own availability
async function updateAvailability(req, res) {
  try {
    const { available } = req.body

    if (typeof available !== 'boolean') {
      return res.status(400).json({ error: 'available must be true or false.' })
    }

    const { data, error } = await supabase
      .from('transporter_profiles')
      .update({ available })
      .eq('user_id', req.user.id)
      .select('id, available')
      .single()

    if (error) throw error

    return res.status(200).json({
      message: `You are now ${data.available ? 'available' : 'off duty'}.`,
      available: data.available,
    })
  } catch (err) {
    console.error('UpdateAvailability error:', err.message)
    return res.status(500).json({ error: 'Failed to update availability.' })
  }
}

// ── PATCH /api/transporters/profile ───────────────────────────────
// Transporter updates their own profile details
async function updateProfile(req, res) {
  try {
    const { truckType, capacity, location, cargoTypes, pricePerKm, pricePerTonne } = req.body

    const updates = {}
    if (truckType !== undefined)     updates.truck_type      = truckType
    if (capacity !== undefined)      updates.capacity        = capacity
    if (location !== undefined)      updates.location        = location
    if (cargoTypes !== undefined)    updates.cargo_types     = cargoTypes
    if (pricePerKm !== undefined)    updates.price_per_km    = pricePerKm
    if (pricePerTonne !== undefined) updates.price_per_tonne = pricePerTonne

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

    return res.status(200).json({ message: 'Profile updated.', profile: data })
  } catch (err) {
    console.error('UpdateProfile error:', err.message)
    return res.status(500).json({ error: 'Failed to update profile.' })
  }
}

module.exports = {
  getTransporters,
  getTransporterById,
  updateAvailability,
  updateProfile,
}