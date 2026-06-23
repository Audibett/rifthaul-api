const router = require('express').Router()
const {
  initiatePayment,
  handleIPN,
  verifyPayment,
  getMyPayments,
  getAllPayments,
} = require('../controllers/paymentController')
const { authenticate, requireRole } = require('../middleware/auth')

// Public — PesaPal calls this, no auth
router.post('/ipn', handleIPN)

// Authenticated routes
router.post('/initiate',  authenticate, requireRole('customer'), initiatePayment)
router.get('/verify',     authenticate, verifyPayment)
router.get('/my',         authenticate, requireRole('customer'), getMyPayments)
router.get('/all',        authenticate, requireRole('admin'),    getAllPayments)

module.exports = router