const router = require('express').Router()
const {
  createBooking,
  getMyBookings,
  getMyJobs,
  getBookingById,
  updateBookingStatus,
} = require('../controllers/bookingController')
const { authenticate, requireRole } = require('../middleware/auth')
const { validate, schemas } = require('../middleware/validate')

router.use(authenticate)

router.post('/',    requireRole('customer'),     validate(schemas.booking), createBooking)
router.get('/my',   requireRole('customer'),     getMyBookings)
router.get('/jobs', requireRole('transporter'),  getMyJobs)
router.get('/:id',                               getBookingById)
router.patch('/:id/status', validate(schemas.status), updateBookingStatus)

module.exports = router