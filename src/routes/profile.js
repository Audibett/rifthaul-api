const router = require('express').Router()
const {
  getProfile,
  updateProfile,
  updateTransporterProfile,
  changePassword,
} = require('../controllers/profileController')
const { authenticate, requireRole } = require('../middleware/auth')

// All profile routes require login
router.use(authenticate)

router.get('/',              getProfile)
router.patch('/',            updateProfile)
router.patch('/transporter', requireRole('transporter'), updateTransporterProfile)
router.patch('/password',    changePassword)

module.exports = router