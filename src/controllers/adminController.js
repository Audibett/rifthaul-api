const supabase = require('../db/supabase')

// ── GET /api/admin/stats ───────────────────────────────────────────
async function getStats(req, res) {
  try {
    const [usersRes, bookingsRes, transportersRes] = await Promise.all([
      supabase.from('users').select('id, role', { count: 'exact' }),
      supabase.from('bookings').select('id, status, amount', { count: 'exact' }),
      supabase.from('transporter_profiles').select('id, available', { count: 'exact' }),
    ])

    if (usersRes.error) throw usersRes.error
    if (bookingsRes.error) throw bookingsRes.error
    if (transportersRes.error) throw transportersRes.error

    const users      = usersRes.data || []
    const bookings   = bookingsRes.data || []
    const transporters = transportersRes.data || []

    const totalRevenue = bookings
      .filter((b) => b.status === 'completed')
      .reduce((sum, b) => sum + (b.amount || 0), 0)

    return res.status(200).json({
      stats: {
        totalUsers:          users.length,
        totalCustomers:      users.filter((u) => u.role === 'customer').length,
        totalTransporters:   users.filter((u) => u.role === 'transporter').length,
        totalBookings:       bookings.length,
        pendingBookings:     bookings.filter((b) => b.status === 'pending').length,
        activeBookings:      bookings.filter((b) => b.status === 'active').length,
        completedBookings:   bookings.filter((b) => b.status === 'completed').length,
        availableTransporters: transporters.filter((t) => t.available).length,
        totalRevenue,
      },
    })
  } catch (err) {
    console.error('GetStats error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch stats.' })
  }
}

// ── GET /api/admin/users ───────────────────────────────────────────
async function getUsers(req, res) {
  try {
    const { role, search, status } = req.query

    let query = supabase
      .from('users')
      .select('id, name, email, phone, role, suspended, created_at')
      .order('created_at', { ascending: false })

    if (role && role !== 'all') {
      query = query.eq('role', role)
    }

    if (status === 'suspended') {
      query = query.eq('suspended', true)
    } else if (status === 'active') {
      query = query.eq('suspended', false)
    }

    const { data, error } = await query
    if (error) throw error

    let users = data

    if (search) {
      const s = search.toLowerCase()
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(s) ||
          u.email.toLowerCase().includes(s) ||
          u.phone?.toLowerCase().includes(s)
      )
    }

    return res.status(200).json({ users })
  } catch (err) {
    console.error('GetUsers error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch users.' })
  }
}

// ── GET /api/admin/bookings ────────────────────────────────────────
async function getAllBookings(req, res) {
  try {
    const { status } = req.query

    let query = supabase
      .from('bookings')
      .select(`
        *,
        users!customer_id ( name, email, phone )
      `)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw error

    const bookings = data.map((b) => ({
      id:          b.id,
      customer:    b.users?.name || 'Unknown',
      email:       b.users?.email || '',
      transporter: b.transporter_name,
      truck:       b.truck,
      from:        b.from_location,
      to:          b.to_location,
      date:        b.date,
      cargoType:   b.cargo_type,
      weight:      b.weight,
      amount:      b.amount,
      status:      b.status,
      createdAt:   b.created_at,
    }))

    return res.status(200).json({ bookings })
  } catch (err) {
    console.error('GetAllBookings error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch bookings.' })
  }
}

// ── GET /api/admin/transporters ────────────────────────────────────
async function getAllTransporters(req, res) {
  try {
    const { data, error } = await supabase
      .from('transporter_profiles')
      .select(`
        id,
        truck_type,
        capacity,
        location,
        cargo_types,
        price_per_km,
        price_per_tonne,
        rating,
        trips,
        available,
        users ( id, name, email, phone, suspended )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    const transporters = data.map((t) => ({
      id:            t.id,
      userId:        t.users?.id,
      name:          t.users?.name || 'Unknown',
      email:         t.users?.email || '',
      phone:         t.users?.phone || '',
      suspended:     t.users?.suspended || false,
      truck:         t.truck_type,
      capacity:      t.capacity,
      location:      t.location,
      cargoTypes:    t.cargo_types || [],
      pricePerKm:    t.price_per_km,
      pricePerTonne: t.price_per_tonne,
      rating:        t.rating,
      trips:         t.trips,
      available:     t.available,
    }))

    return res.status(200).json({ transporters })
  } catch (err) {
    console.error('GetAllTransporters error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch transporters.' })
  }
}

// ── PATCH /api/admin/users/:id/suspend ────────────────────────────
async function suspendUser(req, res) {
  try {
    const { id } = req.params
    const { suspended } = req.body

    if (typeof suspended !== 'boolean') {
      return res.status(400).json({ error: 'suspended must be true or false.' })
    }

    // Prevent admin from suspending themselves
    if (id === req.user.id) {
      return res.status(403).json({ error: 'You cannot suspend your own account.' })
    }

    const { data, error } = await supabase
      .from('users')
      .update({ suspended })
      .eq('id', id)
      .select('id, name, email, role, suspended')
      .single()

    if (error) throw error

    return res.status(200).json({
      message: `${data.name} has been ${suspended ? 'suspended' : 'reactivated'}.`,
      user: data,
    })
  } catch (err) {
    console.error('SuspendUser error:', err.message)
    return res.status(500).json({ error: 'Failed to update user.' })
  }
}

// ── PATCH /api/admin/users/:id/role ───────────────────────────────
async function updateUserRole(req, res) {
  try {
    const { id } = req.params
    const { role } = req.body

    if (!role) {
      return res.status(400).json({ error: 'Role is required.' })
    }

    if (!['customer', 'transporter', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be customer, transporter, or admin.' })
    }

    // Prevent admin from changing their own role
    if (id === req.user.id) {
      return res.status(403).json({ error: 'You cannot change your own role.' })
    }

    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', id)
      .select('id, name, email, role')
      .single()

    if (error) throw error

    return res.status(200).json({
      message: `${data.name} is now a ${role}.`,
      user: data,
    })
  } catch (err) {
    console.error('UpdateUserRole error:', err.message)
    return res.status(500).json({ error: 'Failed to update user role.' })
  }
}

module.exports = {
  getStats,
  getUsers,
  getAllBookings,
  getAllTransporters,
  suspendUser,
  updateUserRole,
}