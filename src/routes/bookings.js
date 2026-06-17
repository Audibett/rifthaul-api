const router = require('express').Router()
const {
  createBooking,
  getMyBookings,
  getMyJobs,
  getBookingById,
  updateBookingStatus,
} = require('../controllers/bookingController')
const { authenticate, requireRole } = require('../middleware/auth')

// All booking routes require login
router.use(authenticate)

// Customer routes
router.post('/', requireRole('customer'), createBooking)
router.get('/my', requireRole('customer'), getMyBookings)

// Transporter routes
router.get('/jobs', requireRole('transporter'), getMyJobs)

// Shared routes
router.get('/:id', getBookingById)
router.patch('/:id/status', updateBookingStatus)

module.exports = router