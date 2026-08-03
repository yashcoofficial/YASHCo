export function isEmailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

export function isIndianMobileValid(value) {
  const raw = String(value || '').trim()
  if (!raw) return false
  const digits = raw.replace(/^\+91/, '').replace(/\D/g, '')
  return /^([6-9]\d{9})$/.test(digits)
}

export function validateCheckoutForm(form) {
  const errors = {}
  const customerName = String(form?.customerName || '').trim()
  const customerEmail = String(form?.customerEmail || '').trim()
  const customerPhone = String(form?.customerPhone || '').trim()
  const line1 = String(form?.line1 || '').trim()
  const city = String(form?.city || '').trim()
  const state = String(form?.state || '').trim()
  const pincode = String(form?.pincode || '').trim()

  if (!customerName) errors.customerName = 'Full name is required.'
  if (!customerEmail) errors.customerEmail = 'Email is required.'
  else if (!isEmailValid(customerEmail)) errors.customerEmail = 'Please enter a valid email address.'
  if (!customerPhone) errors.customerPhone = 'Phone number is required.'
  else if (!isIndianMobileValid(customerPhone)) errors.customerPhone = 'Please enter a valid Indian mobile number.'
  if (!line1) errors.line1 = 'Shipping address is required.'
  if (!city) errors.city = 'City is required.'
  if (!state) errors.state = 'State is required.'
  if (!pincode) errors.pincode = 'PIN code is required.'

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
