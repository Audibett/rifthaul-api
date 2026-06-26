const supabase = require('../db/supabase')

// ── Helper: generate booking ID like BK-001 ────────────────────────
async function generateBookingId() {
  const { data, error } = await supabase.rpc('nextval', { seq: 'booking_seq' })
  if (error) {
    // fallback to timestamp-based ID if sequence fails
    return `BK-${Date.now().toString().slice(-6)}`
  }
  return `BK-${String(data).padStart(3, '0')}`
}

// ── POST /api/bookings ─────────────────────────────────────────────
// Customer creates a new booking
// Price is calculated server-side from distance + weight so it can't
// be tampered with from the client.
async function createBooking(req, res) {
  try {
    const {
      transporterProfileId,
      transporterName,
      truck,
      from,
      to,
      date,
      cargoType,
      weight,
      notes,
      distanceKm,
    } = req.body

    // Validate required fields
    if (!transporterProfileId || !from || !to || !date || !cargoType || !weight || !distanceKm) {
      return res.status(400).json({ error: 'Missing required booking fields.' })
    }

    // Check transporter exists and is available — also fetch their rates
    const { data: profile, error: profileError } = await supabase
      .from('transporter_profiles')
      .select('id, available, user_id, price_per_km, price_per_tonne, profiles(name)')
      .eq('id', transporterProfileId)
      .single()

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Transporter not found.' })
    }

    // Check if transporter's account is suspended
const { data: transporterUser } = await supabase
  .from('profiles')
  .select('suspended')
  .eq('id', profile.user_id)
  .single()

if (transporterUser?.suspended) {
  return res.status(403).json({ error: 'This transporter is not currently available on the platform.' })
}

if (!profile.available) {
  return res.status(400).json({ error: 'This transporter is currently unavailable.' })
}
    // Parse numeric distance and weight safely
    const distance = parseFloat(distanceKm)
    const weightTonnes = parseFloat(weight) // handles "2.5 tonnes" -> 2.5

    if (isNaN(distance) || distance <= 0) {
      return res.status(400).json({ error: 'Invalid distance value.' })
    }
    if (isNaN(weightTonnes) || weightTonnes <= 0) {
      return res.status(400).json({ error: 'Invalid weight value.' })
    }

    // ── Price calculation: distance cost + weight cost ───────────────
    const distanceCost = distance * (profile.price_per_km || 0)
    const weightCost = weightTonnes * (profile.price_per_tonne || 0)
    const amount = Math.round(distanceCost + weightCost)

    // Generate booking ID
    const bookingId = await generateBookingId()

    // Insert booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        id: bookingId,
        customer_id: req.user.id,
        transporter_profile_id: transporterProfileId,
        transporter_name: transporterName || profile.profiles?.name,
        truck,
        from_location: from,
        to_location: to,
        date,
        cargo_type: cargoType,
        weight,
        notes: notes || '',
        amount,
        status: 'pending',
      })
      .select()
      .single()

    if (bookingError) throw bookingError

    return res.status(201).json({
      message: 'Booking created successfully.',
      booking: formatBooking(booking),
    })
  } catch (err) {
    console.error('CreateBooking error:', err.message)
    return res.status(500).json({ error: 'Failed to create booking.' })
  }
}

// ── GET /api/bookings/my ───────────────────────────────────────────
// Customer sees their own bookings
async function getMyBookings(req, res) {
  try {
    const { status } = req.query

    let query = supabase
      .from('bookings')
      .select('*')
      .eq('customer_id', req.user.id)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return res.status(200).json({
      bookings: data.map(formatBooking),
    })
  } catch (err) {
    console.error('GetMyBookings error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch bookings.' })
  }
}

// ── GET /api/bookings/jobs ─────────────────────────────────────────
// Transporter sees jobs assigned to them
async function getMyJobs(req, res) {
  try {
    const { status } = req.query

    // First get the transporter profile ID for this user
    const { data: profile, error: profileError } = await supabase
      .from('transporter_profiles')
      .select('id')
      .eq('user_id', req.user.id)
      .single()

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Transporter profile not found.' })
    }

    let query = supabase
      .from('bookings')
      .select(`
        *,
        users!customer_id ( name, phone, email )
      `)
      .eq('transporter_profile_id', profile.id)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    // Add customer info to each job
    const jobs = data.map((b) => ({
      ...formatBooking(b),
      customer: {
        name: b.users?.name || 'Unknown',
        phone: b.users?.phone || '',
        email: b.users?.email || '',
      },
    }))

    return res.status(200).json({ jobs })
  } catch (err) {
    console.error('GetMyJobs error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch jobs.' })
  }
}

// ── GET /api/bookings/:id ──────────────────────────────────────────
// Get a single booking by ID
async function getBookingById(req, res) {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Booking not found.' })
    }

    // Make sure the requester owns this booking or is the assigned transporter
    const isCustomer = data.customer_id === req.user.id
    const isTransporter = req.user.role === 'transporter'

    if (!isCustomer && !isTransporter) {
      return res.status(403).json({ error: 'Access denied.' })
    }

    return res.status(200).json({ booking: formatBooking(data) })
  } catch (err) {
    console.error('GetBookingById error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch booking.' })
  }
}

// ── PATCH /api/bookings/:id/status ────────────────────────────────
// Update booking status
// Customer can: cancel (pending only)
// Transporter can: accept (pending→active), complete (active→completed), decline (pending)
async function updateBookingStatus(req, res) {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!status) {
      return res.status(400).json({ error: 'Status is required.' })
    }

    // Fetch the current booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !booking) {
      return res.status(404).json({ error: 'Booking not found.' })
    }

    // ── Customer rules ─────────────────────────────────────────────
    if (req.user.role === 'customer') {
      if (booking.customer_id !== req.user.id) {
        return res.status(403).json({ error: 'This is not your booking.' })
      }
      if (status !== 'cancelled') {
        return res.status(403).json({ error: 'Customers can only cancel bookings.' })
      }
      if (booking.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending bookings can be cancelled.' })
      }
    }

    // ── Transporter rules ──────────────────────────────────────────
    if (req.user.role === 'transporter') {
      // Verify this booking belongs to them
      const { data: profile } = await supabase
        .from('transporter_profiles')
        .select('id')
        .eq('user_id', req.user.id)
        .single()

      if (!profile || booking.transporter_profile_id !== profile.id) {
        return res.status(403).json({ error: 'This is not your job.' })
      }

      const allowedTransitions = {
        pending: ['active', 'declined'],
        active: ['completed'],
      }

      const allowed = allowedTransitions[booking.status] || []
      if (!allowed.includes(status)) {
        return res.status(400).json({
          error: `Cannot move from "${booking.status}" to "${status}".`,
        })
      }

      // When transporter completes a job, increment their trip count
      if (status === 'completed') {
        await supabase.rpc('increment_trips', { transporter_id: profile.id })
      }
    }

    // Apply the status update
    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    return res.status(200).json({
      message: `Booking ${status}.`,
      booking: formatBooking(updated),
    })
  } catch (err) {
    console.error('UpdateBookingStatus error:', err.message)
    return res.status(500).json({ error: 'Failed to update booking status.' })
  }
}

// ── Helper: format a raw DB row into clean frontend shape ──────────
function formatBooking(b) {
  return {
    id: b.id,
    transporter: b.transporter_name,
    truck: b.truck,
    from: b.from_location,
    to: b.to_location,
    date: b.date,
    cargoType: b.cargo_type,
    weight: b.weight,
    notes: b.notes,
    amount: b.amount,
    status: b.status,
    createdAt: b.created_at,
  }
}

module.exports = {
  createBooking,
  getMyBookings,
  getMyJobs,
  getBookingById,
  updateBookingStatus,
}