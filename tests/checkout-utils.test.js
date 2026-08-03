const test = require('node:test')
const assert = require('node:assert/strict')

async function loadUtils() {
  return import('../lib/checkout-utils.mjs')
}

test('validates an Indian checkout form', async () => {
  const { validateCheckoutForm } = await loadUtils()
  const result = validateCheckoutForm({
    customerName: 'Aarav Singh',
    customerEmail: 'aarav@example.com',
    customerPhone: '9876543210',
    line1: '12, Regal Lane',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
  })

  assert.equal(result.isValid, true)
  assert.deepEqual(result.errors, {})
})

test('rejects invalid email and Indian phone numbers', async () => {
  const { validateCheckoutForm } = await loadUtils()
  const result = validateCheckoutForm({
    customerName: '',
    customerEmail: 'not-an-email',
    customerPhone: '123',
    line1: '',
    city: '',
    state: '',
    pincode: '',
  })

  assert.equal(result.isValid, false)
  assert.match(result.errors.customerName, /required/i)
  assert.match(result.errors.customerEmail, /valid email/i)
  assert.match(result.errors.customerPhone, /valid indian mobile/i)
  assert.match(result.errors.line1, /required/i)
})

test('checks email and Indian mobile format helpers', async () => {
  const { isEmailValid, isIndianMobileValid } = await loadUtils()
  assert.equal(isEmailValid('hello@example.com'), true)
  assert.equal(isEmailValid('not-an-email'), false)
  assert.equal(isIndianMobileValid('9876543210'), true)
  assert.equal(isIndianMobileValid('+919876543210'), true)
  assert.equal(isIndianMobileValid('12345'), false)
})
