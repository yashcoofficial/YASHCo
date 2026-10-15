export function getOfferPrice(item) {
  const price = Number(item?.price) || 0
  const salePrice = Number(item?.salePrice)
  return salePrice > 0 && salePrice < price ? salePrice : price
}

export function getDiscountPercentage(item) {
  const price = Number(item?.price) || 0
  const offerPrice = getOfferPrice(item)
  return price > 0 && offerPrice < price ? Math.round(((price - offerPrice) / price) * 100) : 0
}

export const PROMO_CODE = 'YASH15'
export const PROMO_MINIMUM_SUBTOTAL = 4999
export const PROMO_DISCOUNT_RATE = 0.15

export function calculateBill(items = [], shipping = 0, promoCode = '') {
  const allItems = Array.isArray(items) ? items : []
  const subtotal = allItems.reduce((sum, item) => sum + getOfferPrice(item) * (Number(item?.qty) || 0), 0)
  const shippingTotal = Number(shipping) || 0
  const discountEligible = String(promoCode).trim().toUpperCase() === PROMO_CODE && subtotal > PROMO_MINIMUM_SUBTOTAL
  const discount = discountEligible ? Math.round(subtotal * PROMO_DISCOUNT_RATE) : 0

  return {
    subtotal,
    discount,
    shipping: shippingTotal,
    total: subtotal - discount + shippingTotal,
    discountEligible,
  }
}