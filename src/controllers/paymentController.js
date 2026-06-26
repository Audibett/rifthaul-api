const supabase = require('../db/supabase')
const pesapal  = require('../services/pesapal')

// ── POST /api/payments/initiate ────────────────────────────────────
// Called when customer confirms a booking
async function initiatePayment(req, res) {
  try {
    const { bookingId } = req.body

    if (!bookingId) {
      return res.status(400).json({ error: 'Booking ID is required.' })
    }

    // Fetch the booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, profiles!customer_id(name, phone)')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Booking not found.' })
    }

    // Make sure this booking belongs to the logged-in customer
    if (booking.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'This is not your booking.' })
    }

    // Don't allow paying for an already-paid booking
    if (booking.payment_status === 'paid') {
      return res.status(400).json({ error: 'This booking has already been paid.' })
    }

    // Commission is 10% of booking amount
    const commission = Math.round(booking.amount * 0.10)

    // Customer name split
    const fullName  = booking.users?.name || 'Customer'
    const nameParts = fullName.split(' ')
    const firstName = nameParts[0]
    const lastName  = nameParts.slice(1).join(' ') || 'User'

    // Callback URL — frontend page that PesaPal redirects to after payment
    const callbackUrl = `${process.env.CLIENT_URL}/payment/callback?bookingId=${bookingId}`

    // Submit order to PesaPal
    const pesapalResponse = await pesapal.submitOrder({
      orderId:     bookingId,
      amount:      commission,
      description: `RiftHaul booking ${bookingId} - ${booking.cargo_type} from ${booking.from_location} to ${booking.to_location}`,
      email:       booking.profiles?.email || '',
      phone:       booking.profiles?.phone || '',
      firstName,
      lastName,
      callbackUrl,
    })

    if (!pesapalResponse.redirect_url) {
      throw new Error('PesaPal did not return a redirect URL.')
    }

    // Save payment record
    await supabase.from('payments').insert({
      booking_id:           bookingId,
      customer_id:          req.profiles.id,
      amount:               commission,
      commission:           commission,
      pesapal_order_id:     bookingId,
      pesapal_tracking_id:  pesapalResponse.order_tracking_id,
      status:               'pending',
      phone:                booking.profiles?.phone || '',
    })

    return res.status(200).json({
      redirectUrl:      pesapalResponse.redirect_url,
      orderTrackingId:  pesapalResponse.order_tracking_id,
      amount:           commission,
      message:          'Payment initiated. Redirect customer to the payment page.',
    })
  } catch (err) {
    console.error('InitiatePayment error:', err.message)
    return res.status(500).json({ error: 'Failed to initiate payment. Please try again.' })
  }
}

// ── POST /api/payments/ipn ─────────────────────────────────────────
// PesaPal calls this when a payment is completed
async function handleIPN(req, res) {
  try {
    const { orderTrackingId, orderMerchantReference } = req.body

    if (!orderTrackingId) {
      return res.status(400).json({ error: 'Missing orderTrackingId.' })
    }

    // Verify transaction status with PesaPal
    const status = await pesapal.getTransactionStatus(orderTrackingId)

    const paymentStatus = status.payment_status_description?.toLowerCase()

    if (paymentStatus === 'completed') {
      // Update payment record
      await supabase
        .from('payments')
        .update({
          status:              'completed',
          pesapal_tracking_id: orderTrackingId,
          updated_at:          new Date().toISOString(),
        })
        .eq('pesapal_tracking_id', orderTrackingId)

      // Update booking payment status
      await supabase
        .from('bookings')
        .update({ payment_status: 'paid' })
        .eq('id', orderMerchantReference)

      console.log(`✅ Payment confirmed for booking ${orderMerchantReference}`)
    } else if (paymentStatus === 'failed' || paymentStatus === 'invalid') {
      await supabase
        .from('payments')
        .update({
          status:     'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('pesapal_tracking_id', orderTrackingId)
    }

    // PesaPal requires a 200 response with this exact format
    return res.status(200).json({
      orderNotificationType: 'IPNCHANGE',
      orderTrackingId,
      orderMerchantReference,
      status: 200,
    })
  } catch (err) {
    console.error('IPN error:', err.message)
    return res.status(500).json({ error: 'IPN processing failed.' })
  }
}

// ── GET /api/payments/verify ───────────────────────────────────────
// Frontend calls this after customer returns from PesaPal
async function verifyPayment(req, res) {
  try {
    const { orderTrackingId, bookingId } = req.query

    if (!orderTrackingId || !bookingId) {
      return res.status(400).json({ error: 'Missing required parameters.' })
    }

    // Check payment status with PesaPal
    const status = await pesapal.getTransactionStatus(orderTrackingId)
    const paymentStatus = status.payment_status_description?.toLowerCase()

    if (paymentStatus === 'completed') {
      // Update payment and booking in DB
      await supabase
        .from('payments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('pesapal_tracking_id', orderTrackingId)

      await supabase
        .from('bookings')
        .update({ payment_status: 'paid' })
        .eq('id', bookingId)

      return res.status(200).json({
        paid:    true,
        status:  paymentStatus,
        message: 'Payment confirmed successfully.',
      })
    }

    return res.status(200).json({
      paid:    false,
      status:  paymentStatus || 'pending',
      message: 'Payment not yet confirmed.',
    })
  } catch (err) {
    console.error('VerifyPayment error:', err.message)
    return res.status(500).json({ error: 'Failed to verify payment.' })
  }
}

// ── GET /api/payments/my ───────────────────────────────────────────
// Customer sees their own payment history
async function getMyPayments(req, res) {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('customer_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return res.status(200).json({ payments: data })
  } catch (err) {
    console.error('GetMyPayments error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch payments.' })
  }
}

// ── GET /api/payments/all ──────────────────────────────────────────
// Admin sees all payments
async function getAllPayments(req, res) {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        profiles!customer_id ( name, email, phone )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    const payments = data.map((p) => ({
      id:                 p.id,
      bookingId:          p.booking_id,
      customer:           p.profiles?.name || 'Unknown',
      email:              p.profiles?.email || '',
      amount:             p.amount,
      commission:         p.commission,
      status:             p.status,
      pesapalTrackingId:  p.pesapal_tracking_id,
      phone:              p.phone,
      createdAt:          p.created_at,
    }))

    return res.status(200).json({ payments })
  } catch (err) {
    console.error('GetAllPayments error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch payments.' })
  }
}

module.exports = {
  initiatePayment,
  handleIPN,
  verifyPayment,
  getMyPayments,
  getAllPayments,
}