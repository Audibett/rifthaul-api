const router = require('express').Router()
const {
  getStats,
  getUsers,
  getAllBookings,
  getAllTransporters,
  suspendUser,
  updateUserRole,
} = require('../controllers/adminController')
const { authenticate, requireRole } = require('../middleware/auth')
const { validate, schemas } = require('../middleware/validate')

router.use(authenticate)
router.use(requireRole('admin'))

router.get('/stats',               getStats)
router.get('/users',               getUsers)
router.get('/bookings',            getAllBookings)
router.get('/transporters',        getAllTransporters)
router.patch('/users/:id/suspend', validate(schemas.suspend),  suspendUser)
router.patch('/users/:id/role',    validate(schemas.role),     updateUserRole)

module.exports = router