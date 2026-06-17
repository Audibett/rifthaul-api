const router = require('express').Router()
const {
  getTransporters,
  getTransporterById,
  updateAvailability,
  updateProfile,
} = require('../controllers/transporterController')
const { authenticate, requireRole } = require('../middleware/auth')

// Public
router.get('/', getTransporters)
router.get('/:id', getTransporterById)

// Transporter only
router.patch('/availability', authenticate, requireRole('transporter'), updateAvailability)
router.patch('/profile', authenticate, requireRole('transporter'), updateProfile)

module.exports = router