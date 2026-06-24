const Joi = require('joi')

// ── Reusable validation middleware factory ─────────────────────────
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,    // return ALL errors, not just the first
      stripUnknown: true,   // remove any fields not in the schema
    })

    if (error) {
      const messages = error.details.map((d) => d.message.replace(/"/g, ''))
      return res.status(400).json({
        error: messages[0],      // show first error to user
        details: messages,       // all errors for debugging
      })
    }

    req.body = value  // use the sanitized/validated values
    next()
  }
}

// ── Schemas ────────────────────────────────────────────────────────

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required()
    .messages({
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name must be less than 100 characters',
      'any.required': 'Name is required',
    }),

  email: Joi.string().email().required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required',
    }),

  phone: Joi.string()
    .pattern(/^(\+254|0)[17]\d{8}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please enter a valid Kenyan phone number (e.g. +254712345678)',
      'any.required': 'Phone number is required',
    }),

  password: Joi.string().min(6).max(100).required()
    .messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'Password is required',
    }),

  role: Joi.string().valid('customer', 'transporter').required()
    .messages({
      'any.only': 'Role must be customer or transporter',
      'any.required': 'Role is required',
    }),

  // Transporter-only fields (optional for customers)
  truckType:  Joi.string().max(100).allow('').optional(),
  capacity:   Joi.string().max(20).allow('').optional(),
  location:   Joi.string().max(100).allow('').optional(),
  cargoTypes: Joi.array().items(Joi.string()).optional(),
})

const loginSchema = Joi.object({
  email: Joi.string().email().required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required',
    }),

  password: Joi.string().required()
    .messages({ 'any.required': 'Password is required' }),

  role: Joi.string().valid('customer', 'transporter').optional(),
})

const bookingSchema = Joi.object({
  transporterProfileId: Joi.string().uuid().required()
    .messages({
      'string.uuid': 'Invalid transporter ID',
      'any.required': 'Transporter is required',
    }),

  transporterName: Joi.string().max(100).required(),
  truck:           Joi.string().max(100).required(),

  from: Joi.string().min(2).max(200).required()
    .messages({
      'string.min': 'Pickup location is too short',
      'any.required': 'Pickup location is required',
    }),

  to: Joi.string().min(2).max(200).required()
    .messages({
      'string.min': 'Destination is too short',
      'any.required': 'Destination is required',
    }),

  date: Joi.string().isoDate().required()
    .messages({
      'string.isoDate': 'Please select a valid date',
      'any.required': 'Pickup date is required',
    }),

  cargoType: Joi.string().valid(
    'General', 'Agricultural', 'Electronics',
    'Furniture', 'Building Materials', 'Perishables', 'Heavy Machinery'
  ).required()
    .messages({ 'any.only': 'Please select a valid cargo type' }),

  weight: Joi.string().required()
    .messages({ 'any.required': 'Weight is required' }),

  distanceKm: Joi.number().positive().required()
    .messages({
      'number.positive': 'Distance must be a positive number',
      'any.required': 'Distance is required',
    }),

  notes: Joi.string().max(500).allow('').optional(),
})

const statusSchema = Joi.object({
  status: Joi.string()
    .valid('active', 'completed', 'cancelled', 'declined')
    .required()
    .messages({
      'any.only': 'Invalid status value',
      'any.required': 'Status is required',
    }),
})

const suspendSchema = Joi.object({
  suspended: Joi.boolean().required()
    .messages({ 'any.required': 'suspended field is required' }),
})

const roleSchema = Joi.object({
  role: Joi.string()
    .valid('customer', 'transporter', 'admin')
    .required()
    .messages({
      'any.only': 'Role must be customer, transporter, or admin',
      'any.required': 'Role is required',
    }),
})

const availabilitySchema = Joi.object({
  available: Joi.boolean().required()
    .messages({ 'any.required': 'available field is required' }),
})

module.exports = {
  validate,
  schemas: {
    register:     registerSchema,
    login:        loginSchema,
    booking:      bookingSchema,
    status:       statusSchema,
    suspend:      suspendSchema,
    role:         roleSchema,
    availability: availabilitySchema,
  },
}