const axios = require('axios')

const BASE_URL = process.env.PESAPAL_ENV === 'production'
  ? 'https://pay.pesapal.com/v3'
  : 'https://cybqa.pesapal.com/pesapalv3'

// ── Get access token ───────────────────────────────────────────────
async function getAccessToken() {
  const res = await axios.post(
    `${BASE_URL}/api/Auth/RequestToken`,
    {
      consumer_key:    process.env.PESAPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
    },
    { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
  )
  return res.data.token
}

// ── Submit order to PesaPal ────────────────────────────────────────
async function submitOrder({ orderId, amount, description, email, phone, firstName, lastName, callbackUrl }) {
  const token = await getAccessToken()

  const res = await axios.post(
    `${BASE_URL}/api/Transactions/SubmitOrderRequest`,
    {
      id:              orderId,
      currency:        'KES',
      amount:          amount,
      description:     description,
      callback_url:    callbackUrl,
      notification_id: process.env.PESAPAL_IPN_ID,
      billing_address: {
        email_address: email,
        phone_number:  phone,
        first_name:    firstName,
        last_name:     lastName,
      },
    },
    {
      headers: {
        'Content-Type':  'application/json',
        Accept:          'application/json',
        Authorization:   `Bearer ${token}`,
      },
    }
  )

  return res.data // { order_tracking_id, merchant_reference, redirect_url }
}

// ── Get transaction status ─────────────────────────────────────────
async function getTransactionStatus(orderTrackingId) {
  const token = await getAccessToken()

  const res = await axios.get(
    `${BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    {
      headers: {
        Accept:        'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  )

  return res.data
}

module.exports = { getAccessToken, submitOrder, getTransactionStatus }