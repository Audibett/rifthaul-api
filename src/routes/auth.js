const router = require('express').Router()
const {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController')
const { authenticate } = require('../middleware/auth')
const { validate, schemas } = require('../middleware/validate')

router.post('/register',        validate(schemas.register), register)
router.post('/login',           validate(schemas.login),    login)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password',  resetPassword)
router.get('/me',               authenticate,               getMe)

module.exports = router