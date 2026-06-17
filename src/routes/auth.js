const router = require('express').Router()
const { register, login, getMe } = require('../controllers/authController')
const { authenticate } = require('../middleware/auth')

// Public routes
router.post('/register', register)
router.post('/login', login)

// Protected route
router.get('/me', authenticate, getMe)

module.exports = router