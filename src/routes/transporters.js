const router = require('express').Router()
const {
  getTransporters,
  getTransporterById,
  updateAvailability,
  updateProfile,
} = require('../controllers/transporterController')
const { authenticate, requireRole } = require('../middleware/auth')
const { validate, schemas } = require('../middleware/validate')

router.get('/',    getTransporters)
router.get('/:id', getTransporterById)

router.patch(
  '/availability',
  authenticate,
  requireRole('transporter'),
  validate(schemas.availability),
  updateAvailability
)

router.patch(
  '/profile',
  authenticate,
  requireRole('transporter'),
  updateProfile
)

module.exports = router